import { lstat, mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { tryCatch } from "../shared/errors.ts";
import { isError } from "../shared/fs.ts";
import { backupFiles, restoreApplied, writeEntry } from "./files.ts";
import { safeParents, safePath } from "./paths.ts";
import { changedPaths, entries } from "./trees.ts";
import type { FileContent, TreeEntry } from "./types.ts";

const validateChanges = async (
  target: string,
  before: Map<string, TreeEntry>,
  after: Map<string, TreeEntry>,
  changed: string[],
  deleted: Set<string>,
): Promise<void> => {
  for (const path of changed) {
    safePath(target, path);
    await safeParents(target, path, deleted);
    if (before.has(path) || !after.has(path)) continue;

    const { error } = await tryCatch(lstat(safePath(target, path)));
    if (error) {
      if (isError(error, "ENOENT")) continue;
      throw error;
    }
    throw new Error(`Would overwrite an ignored/untracked path: ${path}`);
  }
};

export const materialize = async (target: string, objectRepo: string, before: string, after: string): Promise<void> => {
  const old = await entries(objectRepo, before);
  const next = await entries(objectRepo, after);
  const changed = changedPaths(old, next);
  const deleted = new Set(changed.filter(path => old.has(path)));
  await validateChanges(target, old, next, changed, deleted);

  const backups = await backupFiles(target, [...deleted]);
  const applied = new Map<string, FileContent | undefined>();
  const applyChanges = async (): Promise<void> => {
    for (const path of [...deleted].sort((a, b) => b.length - a.length)) {
      await rm(safePath(target, path));
      applied.set(path, undefined);
    }
    for (const path of changed) {
      const entry = next.get(path);
      if (!entry) continue;
      const full = safePath(target, path);
      await safeParents(target, path);
      await mkdir(dirname(full), { recursive: true });
      applied.set(path, await writeEntry(full, objectRepo, entry));
    }
  };
  const { error } = await tryCatch(applyChanges());
  if (!error) return;
  await restoreApplied(target, applied, backups);
  throw error;
};
