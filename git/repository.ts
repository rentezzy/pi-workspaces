import { lstat, realpath } from "node:fs/promises";
import { join } from "node:path";
import { tryCatch } from "../shared/errors.ts";
import { isError } from "../shared/fs.ts";
import { git } from "./command.ts";
import { GIT_DIRECTORY, GIT_OPERATION_PATHS, SUBMODULE_TREE_MODE } from "./constants.ts";

export const assertIdle = async (root: string): Promise<void> => {
  for (const name of GIT_OPERATION_PATHS) {
    const { error } = await tryCatch(lstat(join(root, GIT_DIRECTORY, name)));
    if (error) {
      if (isError(error, "ENOENT")) continue;
      throw error;
    }
    throw new Error(`Finish the Git operation or remove its stale lock first: ${name}`);
  }
  if (await git(root, ["ls-files", "-u"])) throw new Error("Resolve existing Git conflicts first.");
};

export const repository = async (path: string): Promise<string> => {
  const root = await realpath(await git(path, ["rev-parse", "--show-toplevel"]));
  const metadata = await lstat(join(root, GIT_DIRECTORY));
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error("Use an independent Git repository, not a linked worktree.");

  await assertIdle(root);
  if ((await git(root, ["ls-files", "--stage"])).split("\n").some(line => line.startsWith(`${SUBMODULE_TREE_MODE} `)))
    throw new Error("Submodules are not supported by workspace copies yet.");
  if ((await git(root, ["config", "--bool", "core.sparseCheckout"], { allowFailure: true })) === "true")
    throw new Error("Sparse checkouts are not supported yet.");

  await git(root, ["rev-parse", "--verify", "HEAD"]);
  return root;
};

export const branches = async (root: string): Promise<Record<string, string>> => {
  const output = await git(root, ["for-each-ref", "--format=%(refname:strip=2)%00%(objectname)", "refs/heads/"]);
  return Object.fromEntries(output ? output.split("\n").map(line => line.split("\0") as [string, string]) : []);
};
