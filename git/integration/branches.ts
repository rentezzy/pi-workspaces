import { lstat } from "node:fs/promises";
import { join } from "node:path";
import { tryCatch } from "../../shared/errors.ts";
import { isError } from "../../shared/fs.ts";
import { run } from "../../shared/process.ts";
import type { Registry } from "../../workspaces/registry.ts";
import type { Catalog } from "../../workspaces/types.ts";
import { git } from "../command.ts";
import { GIT_DIRECTORY, REBASE_OPTIONS, REBASE_PATHS } from "../constants.ts";
import { ancestor } from "../trees.ts";
import type { BranchPlan, BranchReceipt, MergeResult, Operation, Receipt } from "../types.ts";
import { report } from "./planning.ts";

const rebaseInProgress = async (path: string): Promise<boolean> => {
  for (const item of REBASE_PATHS) {
    const { error } = await tryCatch(lstat(join(path, GIT_DIRECTORY, item)));
    if (!error) return true;
    if (!isError(error, "ENOENT")) throw error;
  }
  return false;
};

const branchConflicts = async (operation: Operation, registry: Registry, catalog: Catalog): Promise<MergeResult> => {
  operation.state = "branch-conflict";
  const output = await run("git", ["diff", "--name-only", "--diff-filter=U", "-z"], { cwd: operation.path });
  operation.conflicts = output.stdout.toString().split("\0").filter(Boolean);
  await registry.save(catalog);
  return report(operation, "conflicts");
};

export const resumeBranch = async (
  operation: Operation,
  registry: Registry,
  catalog: Catalog,
  signal?: AbortSignal,
): Promise<MergeResult | undefined> => {
  const plan = operation.plans[operation.current!];
  if (!plan) throw new Error("Missing paused branch plan.");
  if (await rebaseInProgress(operation.path)) {
    if (await git(operation.path, ["ls-files", "-u"])) return await branchConflicts(operation, registry, catalog);
    const continued = await run("git", [...REBASE_OPTIONS, "--continue"], {
      cwd: operation.path,
      signal,
      allowFailure: true,
    });
    if (continued.code) {
      if (await rebaseInProgress(operation.path)) return await branchConflicts(operation, registry, catalog);
      throw new Error(continued.stderr);
    }
  }

  const resolved = await git(operation.path, ["rev-parse", "HEAD"]);
  if (!plan.old || !(await ancestor(operation.path, plan.old, resolved)))
    throw new Error("Integration was aborted or rewound; destination has not been changed.");
  plan.result = resolved;
  operation.state = "preparing";
  operation.conflicts = [];
};

const prepareBranch = async (
  operation: Operation,
  plan: BranchPlan,
  previous: BranchReceipt | undefined,
  signal?: AbortSignal,
): Promise<string | null> => {
  if (!plan.old) return plan.incoming;
  if (previous?.source === plan.incoming) {
    if (!(await ancestor(operation.path, previous.result, plan.old)))
      throw new Error(`Destination branch ${plan.name} rewrote previously integrated history.`);
    return plan.old;
  }
  if (await ancestor(operation.path, plan.incoming, plan.old)) return plan.old;
  if (await ancestor(operation.path, plan.old, plan.incoming)) return plan.incoming;

  if (previous) {
    if (
      !(await ancestor(operation.path, previous.source, plan.incoming)) ||
      !(await ancestor(operation.path, previous.result, plan.old))
    )
      throw new Error(`History rewrite detected on ${plan.name}; no branch will be rewound.`);
    plan.base = previous.source;
  } else {
    plan.base = await git(operation.path, ["merge-base", plan.old, plan.incoming]);
  }
  if (!plan.base) throw new Error(`No common history for branch ${plan.name}.`);

  await git(operation.path, ["checkout", "--detach", "--force", plan.incoming], { signal });
  const rebased = await run("git", [...REBASE_OPTIONS, "--rebase-merges", "--onto", plan.old, plan.base], {
    cwd: operation.path,
    signal,
    allowFailure: true,
  });
  if (!rebased.code) return await git(operation.path, ["rev-parse", "HEAD"]);
  if (await rebaseInProgress(operation.path)) return null;
  throw new Error(rebased.stderr || "Branch integration failed.");
};

export const prepareBranches = async (
  operation: Operation,
  receipt: Receipt | undefined,
  registry: Registry,
  catalog: Catalog,
  signal?: AbortSignal,
): Promise<MergeResult | undefined> => {
  for (const [index, plan] of operation.plans.entries()) {
    if (plan.result) continue;
    signal?.throwIfAborted();
    operation.current = index;
    const result = await prepareBranch(operation, plan, receipt?.branches[plan.name], signal);
    if (result === null) return await branchConflicts(operation, registry, catalog);
    plan.result = result;
    await registry.save(catalog);
  }
};
