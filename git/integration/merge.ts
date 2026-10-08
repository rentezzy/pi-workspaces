import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { Config } from "../../config/types.ts";
import { tryCatch } from "../../shared/errors.ts";
import type { Registry } from "../../workspaces/registry.ts";
import type { Catalog, Workspace } from "../../workspaces/types.ts";
import { localPath } from "../../workspaces/utils.ts";
import { DEFAULT_MERGE_MODE } from "../constants.ts";
import { capture, sameSnapshot } from "../snapshots.ts";
import type { MergeOptions, MergeResult, Operation, Receipt } from "../types.ts";
import { prepareBranches, resumeBranch } from "./branches.ts";
import { commonBaseline, createReceipt, planBranches, report } from "./planning.ts";
import { preparePublication, prepareRepository } from "./preparation.ts";
import { publish } from "./publish.ts";

const completeIntegration = async (
  registry: Registry,
  catalog: Catalog,
  operation: Operation,
  receipt: Receipt | undefined,
  sourcePath: string,
  targetPath: string,
  config: Config,
  options: MergeOptions,
  signal?: AbortSignal,
): Promise<MergeResult> => {
  const paused = await prepareBranches(operation, receipt, registry, catalog, signal);
  if (paused) return paused;
  await preparePublication(operation, targetPath, signal);
  if (!sameSnapshot(operation.target, await capture(targetPath, config, signal)))
    throw new Error("Destination changed while integration was prepared. Nothing was published.");
  if (!options.resume && !sameSnapshot(operation.source, await capture(sourcePath, config, signal)))
    throw new Error("Source changed while integration was prepared. Nothing was published.");

  signal?.throwIfAborted();
  operation.state = "publishing";
  await registry.save(catalog);
  await publish(targetPath, operation);
  operation.state = "complete";
  catalog.receipts.push(createReceipt(operation, Date.now()));
  await registry.save(catalog);
  return report(operation, operation.conflicts?.length ? "conflicts" : "merged");
};

export const integrate = async (
  registry: Registry,
  catalog: Catalog,
  source: Workspace,
  target: Workspace,
  config: Config,
  options: MergeOptions,
  signal?: AbortSignal,
): Promise<MergeResult> => {
  const sourcePath = localPath(source);
  const targetPath = localPath(target);
  const receipt = [...catalog.receipts]
    .reverse()
    .find(receipt => receipt.sourceId === source.id && receipt.targetId === target.id);
  let operation: Operation;

  if (options.resume) {
    const stored = catalog.operations.find(operation => operation.id === options.resume);
    if (!stored || stored.sourceId !== source.id || stored.targetId !== target.id || stored.state !== "branch-conflict")
      throw new Error("No matching paused branch integration.");
    operation = stored;
    if (!sameSnapshot(operation.target, await capture(targetPath, config, signal)))
      throw new Error(`Destination changed since integration paused; recovery is retained at ${operation.path}.`);
    const paused = await resumeBranch(operation, registry, catalog, signal);
    if (paused) return paused;
  } else {
    const pending = catalog.operations.find(
      operation => operation.targetId === target.id && operation.state !== "complete" && operation.state !== "failed",
    );
    if (pending) throw new Error(`An unfinished integration exists: ${pending.id} at ${pending.path}.`);

    const sourceSnapshot = await capture(sourcePath, config, signal);
    const targetSnapshot = await capture(targetPath, config, signal);
    const id = randomUUID();
    const path = join(registry.directory, "integrations", id);
    operation = {
      id,
      sourceId: source.id,
      targetId: target.id,
      mode: options.mode ?? DEFAULT_MERGE_MODE,
      path,
      state: "preparing",
      source: sourceSnapshot,
      target: targetSnapshot,
      baseline: receipt?.source ?? commonBaseline(catalog, source, target),
      plans: planBranches(sourceSnapshot, targetSnapshot),
    };
    catalog.operations.push(operation);
    await registry.save(catalog);
    const { error } = await tryCatch(prepareRepository(registry.directory, targetPath, sourcePath, path, signal));
    if (error) {
      operation.state = "failed";
      operation.error = String(error);
      await registry.save(catalog);
      throw error;
    }
  }

  const { data, error } = await tryCatch(
    completeIntegration(registry, catalog, operation, receipt, sourcePath, targetPath, config, options, signal),
  );
  if (!error) return data;

  const publishing = operation.state === "publishing";
  operation.state = publishing ? "recovery-required" : "failed";
  operation.error = `${String(error)}${
    publishing
      ? ` Recovery journal and original trees retained at ${operation.path}; do not delete this directory.`
      : ""
  }`;
  await registry.save(catalog);
  throw new Error(operation.error);
};
