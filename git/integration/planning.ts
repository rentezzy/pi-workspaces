import type { Catalog, Workspace } from "../../workspaces/types.ts";
import type { BranchPlan, IntegrationHead, MergeResult, Operation, Receipt, Snapshot } from "../types.ts";

const ancestry = (catalog: Catalog, workspace: Workspace): Workspace[] => {
  const result = [workspace];
  const seen = new Set([workspace.id]);
  while (workspace.parentId) {
    const parent = catalog.workspaces.find(candidate => candidate.id === workspace.parentId);
    if (!parent || seen.has(parent.id)) throw new Error("Broken workspace provenance.");
    seen.add(parent.id);
    result.push(parent);
    workspace = parent;
  }
  return result;
};

export const commonBaseline = (catalog: Catalog, source: Workspace, target: Workspace): Snapshot => {
  const sourceChain = ancestry(catalog, source);
  const targetChain = ancestry(catalog, target);
  const common = sourceChain.find(workspace => targetChain.some(candidate => candidate.id === workspace.id));
  if (!common) throw new Error("Workspaces have no shared creation baseline.");

  const children = [
    sourceChain[sourceChain.findIndex(workspace => workspace.id === common.id) - 1],
    targetChain[targetChain.findIndex(workspace => workspace.id === common.id) - 1],
  ]
    .filter((workspace): workspace is Workspace => !!workspace)
    .sort((a, b) => a.createdAt - b.createdAt);
  const snapshot = children[0]?.baseline;
  if (!snapshot) throw new Error("No immutable creation baseline is available.");
  return snapshot;
};

export const planBranches = (source: Snapshot, target: Snapshot): BranchPlan[] =>
  Object.entries(source.branches)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, incoming]) => ({ name, incoming, old: target.branches[name] }));

export const selectHead = (operation: Operation): IntegrationHead => {
  const branch = operation.mode === "active" ? operation.source.branch : operation.target.branch;
  const head = branch
    ? (operation.plans.find(plan => plan.name === branch)?.result ?? operation.target.branches[branch])
    : operation.mode === "active"
      ? operation.source.head
      : operation.target.head;
  if (!head) throw new Error("Cannot resolve final destination HEAD.");
  return { head, branch };
};

export const referenceUpdates = (operation: Operation): string => {
  const existing = Object.entries(operation.target.branches).map(([name, oid]) => {
    const plan = operation.plans.find(candidate => candidate.name === name);
    return plan && plan.result !== oid
      ? `update refs/heads/${name} ${plan.result} ${oid}`
      : `verify refs/heads/${name} ${oid}`;
  });
  const created = operation.plans
    .filter(plan => !plan.old)
    .map(plan => `create refs/heads/${plan.name} ${plan.result}`);
  return ["start", ...existing, ...created, "prepare", "commit", ""].join("\n");
};

export const createReceipt = (operation: Operation, createdAt: number): Receipt => ({
  sourceId: operation.sourceId,
  targetId: operation.targetId,
  source: operation.source,
  createdAt,
  branches: Object.fromEntries(
    operation.plans.map(plan => [plan.name, { source: plan.incoming, result: plan.result! }]),
  ),
});

export const report = (operation: Operation, status: MergeResult["status"]): MergeResult => ({
  status,
  operation: operation.id,
  source: operation.sourceId,
  target: operation.targetId,
  mode: operation.mode,
  branches: operation.plans.map(plan => plan.name),
  conflicts: operation.conflicts ?? [],
  ...(operation.state === "branch-conflict"
    ? {
        integrationPath: operation.path,
        instructions: `Resolve and git add conflicts in ${operation.path}, then merge again with resume=${operation.id}. Destination checkout is unchanged.`,
      }
    : {}),
});
