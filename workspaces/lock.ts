import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, rename, rmdir, unlink } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { PRIVATE_DIRECTORY_MODE } from "../shared/constants.ts";
import { tryCatch } from "../shared/errors.ts";
import { readRegular, atomicJSON, isError } from "../shared/fs.ts";
import { LOCK_DIRECTORY, LOCK_WAIT_MS, UNOWNED_LOCK_TIMEOUT_MS } from "./constants.ts";
import { isLockOwner } from "./validation.ts";
import type { LockOwner, LockWaitState, RegistryLock } from "./types.ts";

const ownerFile = (owner: LockOwner): string => `owner-${owner.token}.json`;

const readOwner = async (path: string): Promise<LockOwner> => {
  const owner: unknown = JSON.parse(await readRegular(path));
  if (!isLockOwner(owner) || !path.endsWith(ownerFile(owner))) throw new Error(`Corrupt workspace lock owner: ${path}`);

  return owner;
};

const ownerIsDead = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    if (isError(error, "ESRCH")) return true;
    if (isError(error, "EPERM")) return false;
    throw error;
  }
};

const inspectLock = async (path: string, owner: LockOwner, waiting: LockWaitState): Promise<boolean> => {
  if (!(await lstat(path)).isDirectory()) throw new Error(`Invalid workspace lock: ${path}`);

  const names = await readdir(path);
  if (!names.length) {
    waiting.emptySince ||= Date.now();
    if (Date.now() - waiting.emptySince > UNOWNED_LOCK_TIMEOUT_MS)
      throw new Error(`Workspace lock has no owner; inspect it manually: ${path}`);
    return false;
  }

  waiting.emptySince = 0;
  if (names.length !== 1 || !/^owner-[a-f0-9-]{36}\.json$/.test(names[0]!))
    throw new Error(`Corrupt workspace lock: ${path}`);

  const other = await readOwner(join(path, names[0]!));
  if (other.host !== owner.host) throw new Error(`Workspace lock belongs to another host: ${other.host}`);
  if (!ownerIsDead(other.pid)) return false;

  await unlink(join(path, names[0]!));
  await rmdir(path);
  return true;
};

export const acquireRegistryLock = async (directory: string, signal?: AbortSignal): Promise<RegistryLock> => {
  signal?.throwIfAborted();
  await mkdir(directory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });

  const path = join(directory, LOCK_DIRECTORY);
  const owner = { pid: process.pid, token: randomUUID(), host: hostname() };
  const pending = join(directory, `.${ownerFile(owner)}`);
  const file = join(path, ownerFile(owner));
  const waiting = { emptySince: 0 };

  await atomicJSON(pending, owner);
  try {
    for (;;) {
      signal?.throwIfAborted();
      const { error } = await tryCatch(mkdir(path, { mode: PRIVATE_DIRECTORY_MODE }));
      if (error) {
        if (!isError(error, "EEXIST")) throw error;
        const result = await tryCatch(inspectLock(path, owner, waiting));
        if (result.error && !isError(result.error, "ENOENT")) throw result.error;
        if (!result.data) await delay(LOCK_WAIT_MS, undefined, { signal });
        continue;
      }

      const { error: renameError } = await tryCatch(rename(pending, file));
      if (renameError) {
        await rmdir(path);
        throw renameError;
      }

      const verify = async () => {
        const held = await readOwner(file);
        if (held.pid !== owner.pid || held.token !== owner.token || held.host !== owner.host)
          throw new Error("Workspace lock ownership changed");
      };

      return {
        verify,
        release: async () => {
          await verify();
          await unlink(file);
          await rmdir(path);
        },
      };
    }
  } finally {
    const { error } = await tryCatch(unlink(pending));
    if (error && !isError(error, "ENOENT")) throw error;
  }
};
