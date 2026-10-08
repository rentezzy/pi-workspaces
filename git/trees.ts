import { decode, run } from "../shared/process.ts";
import { git } from "./command.ts";
import {
  HOOKS_DISABLED_OPTIONS,
  OBJECT_ID_PATTERN,
  SNAPSHOT_IDENTITY,
  SNAPSHOT_MESSAGE,
  SUBMODULE_TREE_MODE,
} from "./constants.ts";
import type { TreeEntry, TreeMerge } from "./types.ts";

export const parseEntries = (output: string): Map<string, TreeEntry> =>
  new Map(
    output
      .split("\0")
      .filter(Boolean)
      .map(record => {
        const tab = record.indexOf("\t");
        const [mode, , oid] = record.slice(0, tab).split(" ");
        if (!mode || !oid) throw new Error("Invalid Git tree.");
        if (mode === SUBMODULE_TREE_MODE) throw new Error("Submodule integration is unsupported.");
        return [record.slice(tab + 1), { mode, oid }] as const;
      }),
  );

export const entries = async (root: string, tree: string): Promise<Map<string, TreeEntry>> => {
  const result = await run("git", ["ls-tree", "-rz", tree], { cwd: root });
  return parseEntries(decode(result.stdout));
};

export const changedPaths = (before: Map<string, TreeEntry>, after: Map<string, TreeEntry>): string[] =>
  [...new Set([...before.keys(), ...after.keys()])].filter(path => {
    const old = before.get(path);
    const next = after.get(path);
    return old?.oid !== next?.oid || old?.mode !== next?.mode;
  });

export const treeCommit = async (root: string, tree: string): Promise<string> =>
  await git(root, ["commit-tree", tree], { input: SNAPSHOT_MESSAGE, env: SNAPSHOT_IDENTITY });

export const parseTreeMerge = (output: string, conflicted: boolean): TreeMerge => {
  const [tree, ...records] = output.split("\0");
  if (!tree || !OBJECT_ID_PATTERN.test(tree)) throw new Error("Invalid merge-tree result.");
  const end = records.indexOf("");
  return { tree, conflicts: conflicted ? records.slice(0, end < 0 ? records.length : end) : [] };
};

export const mergeTrees = async (root: string, base: string, left: string, right: string): Promise<TreeMerge> => {
  if (left === right || right === base) return { tree: left, conflicts: [] };
  if (left === base) return { tree: right, conflicts: [] };

  const result = await run(
    "git",
    [
      ...HOOKS_DISABLED_OPTIONS,
      "merge-tree",
      "--write-tree",
      "--name-only",
      "-z",
      "--messages",
      `--merge-base=${await treeCommit(root, base)}`,
      await treeCommit(root, left),
      await treeCommit(root, right),
    ],
    { cwd: root, allowFailure: true },
  );
  if (result.code > 1 || result.code < 0) throw new Error(result.stderr || "Git tree merge failed.");
  return parseTreeMerge(decode(result.stdout), result.code !== 0);
};

export const ancestor = async (root: string, earlier: string, later: string): Promise<boolean> => {
  const result = await run("git", ["merge-base", "--is-ancestor", earlier, later], { cwd: root, allowFailure: true });
  if (result.code > 1) throw new Error(result.stderr);
  return result.code === 0;
};
