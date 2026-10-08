import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, rename, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { PRIVATE_FILE_MODE } from "./constants.ts";
import { tryCatch } from "./errors.ts";
import { nonempty } from "./validation.ts";

export const isError = (error: unknown, code: string): boolean =>
  (error as NodeJS.ErrnoException | null)?.code === code;

export const expand = (path: string): string => {
  if (!nonempty(path)) throw new Error("Expected a nonempty path");
  if (path === "~") return homedir();
  if (path.startsWith("~/") || path.startsWith("~\\")) return join(homedir(), path.slice(2));
  if (path.startsWith("~")) throw new Error(`Unsupported home path: ${path}`);

  return path;
};

export const exists = async (path: string): Promise<boolean> => {
  const { error } = await tryCatch(lstat(path));
  if (!error) return true;
  if (isError(error, "ENOENT")) return false;

  throw error;
};

export const readRegular = async (path: string): Promise<string> => {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);

  try {
    if (!(await file.stat()).isFile()) throw new Error(`Expected a regular file: ${path}`);

    return await file.readFile("utf8");
  } finally {
    await file.close();
  }
};

export const atomicJSON = async (path: string, value: unknown): Promise<void> => {
  const temp = join(dirname(path), `.${randomUUID()}.tmp`);
  const file = await open(temp, "wx", PRIVATE_FILE_MODE);

  try {
    await file.chmod(PRIVATE_FILE_MODE);
    await file.writeFile(JSON.stringify(value, null, 2) + "\n");
    await file.sync();
    await file.close();
    await rename(temp, path);

    const directory = await open(dirname(path), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } finally {
    await file.close();
    const { error } = await tryCatch(unlink(temp));
    if (error && !isError(error, "ENOENT")) throw error;
  }
};
