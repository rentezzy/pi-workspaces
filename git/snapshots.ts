import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "../config/types.ts";
import { decode, run } from "../shared/process.ts";
import { git } from "./command.ts";
import { FINAL_NEWLINE_PATTERN, INDEX_TEMP_PREFIX, SNAPSHOT_REFS, WORKSPACE_REFS } from "./constants.ts";
import { excludes } from "./filter.ts";
import { branches } from "./repository.ts";
import type { Snapshot } from "./types.ts";

export const capture = async (root: string, config: Config, signal?: AbortSignal): Promise<Snapshot> => {
  const temporary = await mkdtemp(join(tmpdir(), INDEX_TEMP_PREFIX));
  try {
    const head = await git(root, ["rev-parse", "HEAD"], { signal });
    const branchResult = await run("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], {
      cwd: root,
      signal,
      allowFailure: true,
    });
    const env = { GIT_INDEX_FILE: join(temporary, "index") };
    const ignore = await excludes(root, config, temporary);
    await git(root, ["read-tree", head], { env, signal });
    await git(root, ["-c", `core.excludesFile=${ignore}`, "add", "-A", "--", "."], { env, signal });

    const snapshot: Snapshot = {
      head,
      branch: branchResult.code ? null : decode(branchResult.stdout).replace(FINAL_NEWLINE_PATTERN, ""),
      branches: await branches(root),
      headTree: await git(root, ["rev-parse", `${head}^{tree}`], { signal }),
      indexTree: await git(root, ["write-tree"], { signal }),
      workTree: await git(root, ["write-tree"], { env, signal }),
    };
    const prefix = `${SNAPSHOT_REFS}/${randomUUID()}`;
    await git(root, ["update-ref", `${prefix}/work`, snapshot.workTree]);
    await git(root, ["update-ref", `${prefix}/index`, snapshot.indexTree]);
    await git(root, ["update-ref", `${prefix}/head`, snapshot.head]);
    for (const [name, oid] of Object.entries(snapshot.branches))
      await git(root, ["update-ref", `${prefix}/branches/${name}`, oid]);
    return snapshot;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
};

export const importSnapshots = async (root: string, from: string, namespace: string): Promise<void> => {
  await git(root, [
    "fetch",
    "--no-tags",
    "--no-write-fetch-head",
    from,
    `+${SNAPSHOT_REFS}/*:${WORKSPACE_REFS}/${namespace}/*`,
  ]);
};

export const sameSnapshot = (a: Snapshot, b: Snapshot): boolean =>
  a.head === b.head &&
  a.branch === b.branch &&
  a.workTree === b.workTree &&
  a.indexTree === b.indexTree &&
  JSON.stringify(Object.entries(a.branches).sort()) === JSON.stringify(Object.entries(b.branches).sort());
