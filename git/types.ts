export type MergeMode = "active" | "passive";

export interface Snapshot {
  head: string;
  branch: string | null;
  branches: Record<string, string>;
  headTree: string;
  indexTree: string;
  workTree: string;
}

export interface BranchReceipt {
  source: string;
  result: string;
}

export interface Receipt {
  sourceId: string;
  targetId: string;
  branches: Record<string, BranchReceipt>;
  source: Snapshot;
  createdAt: number;
}

export interface BranchPlan {
  name: string;
  incoming: string;
  old?: string;
  result?: string;
  base?: string;
}

export interface Operation {
  id: string;
  sourceId: string;
  targetId: string;
  mode: MergeMode;
  path: string;
  state: "preparing" | "branch-conflict" | "publishing" | "recovery-required" | "complete" | "failed";
  source: Snapshot;
  target: Snapshot;
  baseline: Snapshot;
  plans: BranchPlan[];
  current?: number;
  error?: string;
  conflicts?: string[];
  resultTree?: string;
  resultIndex?: string;
  resultHead?: string;
  resultBranch?: string | null;
}

export interface MergeOptions {
  source: string;
  target?: string;
  mode?: MergeMode;
  resume?: string;
  hooks?: boolean;
}

export interface MergeResult {
  status: "merged" | "conflicts";
  operation: string;
  source: string;
  target: string;
  mode: MergeMode;
  branches: string[];
  conflicts: string[];
  integrationPath?: string;
  instructions?: string;
}

export interface TreeEntry {
  mode: string;
  oid: string;
}
export interface TreeMerge {
  tree: string;
  conflicts: string[];
}
export interface FileContent {
  bytes?: Buffer;
  link?: string;
}
export interface FileBackup extends FileContent {
  mode: number;
}
export interface IntegrationHead {
  head: string;
  branch: string | null;
}
