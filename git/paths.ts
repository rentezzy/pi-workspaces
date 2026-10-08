import { lstat } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { tryCatch } from "../shared/errors.ts";
import { isError } from "../shared/fs.ts";
import { GIT_DIRECTORY, WORKSPACE_MARKERS } from "./constants.ts";

export const safePath = (root: string, path: string): string => {
  if (
    !path ||
    path
      .split("/")
      .some(part => part === ".." || part.toLowerCase() === GIT_DIRECTORY || WORKSPACE_MARKERS.includes(part))
  )
    throw new Error(`Protected or unsafe workspace path: ${path}`);

  const full = resolve(root, path);
  const displacement = relative(root, full);
  if (!displacement || displacement.startsWith(`..${sep}`) || displacement === "..")
    throw new Error("Path escapes workspace.");
  return full;
};

export const safeParents = async (root: string, path: string, deleted = new Set<string>()): Promise<void> => {
  let parent = dirname(path);
  while (parent !== ".") {
    const { data: stat, error } = await tryCatch(lstat(safePath(root, parent)));
    if (error) {
      if (!isError(error, "ENOENT")) throw error;
    } else if ((!stat.isDirectory() || stat.isSymbolicLink()) && !deleted.has(parent)) {
      throw new Error(`Unsafe path ancestor: ${parent}`);
    }
    parent = dirname(parent);
  }
};
