import { open, readFile, rename, rm } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { join } from "node:path";
import { PRIVATE_FILE_MODE } from "../../shared/constants.ts";
import { tryCatch } from "../../shared/errors.ts";
import { git } from "../command.ts";
import { GIT_DIRECTORY } from "../constants.ts";
import { materialize } from "../materialize.ts";
import type { Operation } from "../types.ts";
import { referenceUpdates } from "./planning.ts";

const closeQuietly = async (handle: FileHandle): Promise<void> => {
  const { error } = await tryCatch(handle.close());
  if (error) return;
};

export const publish = async (targetPath: string, operation: Operation): Promise<void> => {
  const newIndex = join(operation.path, "publish-index");
  await git(targetPath, ["read-tree", operation.resultIndex!], { env: { GIT_INDEX_FILE: newIndex } });
  const metadata = join(targetPath, GIT_DIRECTORY);
  const indexLock = join(metadata, "index.lock");
  const headLock = join(metadata, "HEAD.lock");
  const indexHandle = await open(indexLock, "wx", PRIVATE_FILE_MODE);
  let headHandle: FileHandle | undefined;

  try {
    await indexHandle.writeFile(await readFile(newIndex));
    await indexHandle.sync();
    await materialize(targetPath, operation.path, operation.target.workTree, operation.resultTree!);
    await git(targetPath, ["update-ref", "--stdin"], { input: referenceUpdates(operation) });

    headHandle = await open(headLock, "wx", PRIVATE_FILE_MODE);
    const expectedHead = operation.target.branch ? `ref: refs/heads/${operation.target.branch}` : operation.target.head;
    if ((await readFile(join(metadata, "HEAD"), "utf8")).trim() !== expectedHead)
      throw new Error("Destination HEAD changed during publication.");
    await headHandle.writeFile(
      operation.resultBranch ? `ref: refs/heads/${operation.resultBranch}\n` : operation.resultHead! + "\n",
    );
    await headHandle.sync();
    await indexHandle.close();
    await headHandle.close();
    await rename(indexLock, join(metadata, "index"));
    await rename(headLock, join(metadata, "HEAD"));
  } finally {
    await closeQuietly(indexHandle);
    if (headHandle) await closeQuietly(headHandle);
    await rm(indexLock, { force: true });
    if (headHandle) await rm(headLock, { force: true });
  }
};
