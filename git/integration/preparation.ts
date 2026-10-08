import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PRIVATE_DIRECTORY_MODE } from "../../shared/constants.ts";
import { git } from "../command.ts";
import { IMPORT_REFS, PUBLISH_REF, SNAPSHOT_IDENTITY, SOURCE_SNAPSHOTS, TARGET_SNAPSHOTS } from "../constants.ts";
import { importSnapshots } from "../snapshots.ts";
import { mergeTrees } from "../trees.ts";
import type { Operation, TreeMerge } from "../types.ts";
import { selectHead } from "./planning.ts";

export const prepareRepository = async (
  directory: string,
  targetPath: string,
  sourcePath: string,
  path: string,
  signal?: AbortSignal,
): Promise<void> => {
  await mkdir(join(directory, "integrations"), { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  await git(targetPath, ["clone", "--no-hardlinks", "--no-checkout", "--no-tags", "--", targetPath, path], { signal });
  const name =
    (await git(targetPath, ["config", "user.name"], { allowFailure: true })) || SNAPSHOT_IDENTITY.GIT_AUTHOR_NAME;
  await git(path, ["config", "user.name", name]);
  const email =
    (await git(targetPath, ["config", "user.email"], { allowFailure: true })) || SNAPSHOT_IDENTITY.GIT_AUTHOR_EMAIL;
  await git(path, ["config", "user.email", email]);
  await importSnapshots(path, targetPath, TARGET_SNAPSHOTS);
  await importSnapshots(path, sourcePath, SOURCE_SNAPSHOTS);
};

const mergeSourceEdits = async (operation: Operation, local: TreeMerge): Promise<TreeMerge> => {
  if (operation.source.workTree === operation.source.headTree) return local;

  const inherited = await mergeTrees(
    operation.path,
    operation.baseline.headTree,
    operation.source.headTree,
    operation.baseline.workTree,
  );
  if (inherited.conflicts.length)
    throw new Error(
      `Creation/transfer baseline conflicts with source history: ${inherited.conflicts.join(", ")}. Destination is unchanged.`,
    );

  const combined = await mergeTrees(operation.path, inherited.tree, local.tree, operation.source.workTree);
  return { tree: combined.tree, conflicts: [...new Set([...local.conflicts, ...combined.conflicts])] };
};

export const preparePublication = async (
  operation: Operation,
  targetPath: string,
  signal?: AbortSignal,
): Promise<void> => {
  const { head, branch } = selectHead(operation);
  const headTree = await git(operation.path, ["rev-parse", `${head}^{tree}`]);
  const stage = await mergeTrees(operation.path, operation.target.headTree, headTree, operation.target.indexTree);
  if (stage.conflicts.length)
    throw new Error(
      `Destination staged edits conflict with incoming commits: ${stage.conflicts.join(", ")}. Destination is unchanged.`,
    );

  const local = await mergeTrees(operation.path, operation.target.headTree, headTree, operation.target.workTree);
  const combined = await mergeSourceEdits(operation, local);

  operation.resultTree = combined.tree;
  operation.resultIndex = stage.tree;
  operation.resultHead = head;
  operation.resultBranch = branch;
  operation.conflicts = combined.conflicts;
  for (const plan of operation.plans)
    await git(operation.path, ["update-ref", `${PUBLISH_REF}/branches/${plan.name}`, plan.result!]);
  await git(operation.path, ["update-ref", `${PUBLISH_REF}/work`, combined.tree]);
  await git(operation.path, ["update-ref", `${PUBLISH_REF}/index`, stage.tree]);
  await git(operation.path, ["update-ref", `${PUBLISH_REF}/head`, head]);
  await git(
    targetPath,
    [
      "fetch",
      "--no-tags",
      "--no-write-fetch-head",
      operation.path,
      `+${PUBLISH_REF}/*:${IMPORT_REFS}/${operation.id}/*`,
    ],
    { signal },
  );
};
