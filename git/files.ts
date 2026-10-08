import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, readlink, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { tryCatch } from "../shared/errors.ts";
import { isError } from "../shared/fs.ts";
import { run } from "../shared/process.ts";
import {
  EXECUTABLE_FILE_MODE,
  EXECUTABLE_TREE_MODE,
  FILE_TEMP_PREFIX,
  REGULAR_FILE_MODE,
  SYMLINK_TREE_MODE,
} from "./constants.ts";
import { safePath } from "./paths.ts";
import type { FileBackup, FileContent, TreeEntry } from "./types.ts";

export const backupFiles = async (root: string, paths: string[]): Promise<Map<string, FileBackup>> => {
  const backups = new Map<string, FileBackup>();
  for (const path of paths) {
    const full = safePath(root, path);
    const stat = await lstat(full);
    backups.set(
      path,
      stat.isSymbolicLink()
        ? { link: await readlink(full), mode: stat.mode }
        : { bytes: await readFile(full), mode: stat.mode },
    );
  }
  return backups;
};

export const writeEntry = async (full: string, objectRepo: string, entry: TreeEntry): Promise<FileContent> => {
  const content = (await run("git", ["cat-file", "blob", entry.oid], { cwd: objectRepo })).stdout;
  if (entry.mode === SYMLINK_TREE_MODE) {
    const link = content.toString();
    await symlink(link, full);
    return { link };
  }

  const temporary = `${full}${FILE_TEMP_PREFIX}${randomUUID()}`;
  try {
    await writeFile(temporary, content, {
      mode: entry.mode === EXECUTABLE_TREE_MODE ? EXECUTABLE_FILE_MODE : REGULAR_FILE_MODE,
    });
    await rename(temporary, full);
  } finally {
    await rm(temporary, { force: true });
  }
  return { bytes: content };
};

const matchesApplied = async (full: string, written: FileContent | undefined): Promise<boolean> => {
  const inspect = async (): Promise<boolean> => {
    const stat = await lstat(full);
    if (written?.link !== undefined) return stat.isSymbolicLink() && (await readlink(full)) === written.link;
    if (written?.bytes !== undefined) return stat.isFile() && (await readFile(full)).equals(written.bytes);
    return false;
  };
  const { data, error } = await tryCatch(inspect());
  if (error) return isError(error, "ENOENT") && written === undefined;
  return data;
};

export const restoreApplied = async (
  target: string,
  applied: Map<string, FileContent | undefined>,
  backups: Map<string, FileBackup>,
): Promise<void> => {
  for (const path of [...applied.keys()].reverse()) {
    const full = safePath(target, path);
    const backup = backups.get(path);
    if (!(await matchesApplied(full, applied.get(path)))) continue;

    await rm(full, { force: true });
    if (!backup) continue;
    await mkdir(dirname(full), { recursive: true });
    if (backup.link !== undefined) {
      await symlink(backup.link, full);
      continue;
    }
    await writeFile(full, backup.bytes!);
    await chmod(full, backup.mode);
  }
};
