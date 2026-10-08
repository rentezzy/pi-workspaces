import { git } from "../git/command.ts";
import { capture, sameSnapshot } from "../git/snapshots.ts";
import { pruneIgnored } from "../git/filter.ts";
import type { Config } from "../config/types.ts";
import type { Snapshot } from "../git/types.ts";

const startingCommit = async (path: string, ref: string, signal?: AbortSignal): Promise<string> => {
  if (ref.startsWith("-")) throw new Error("Invalid starting ref.");

  const commit = await git(path, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`], {
    allowFailure: true,
  });
  if (/^[a-f0-9]{40,64}$/.test(commit)) return commit;

  const slash = ref.indexOf("/");
  const remote = ref.slice(0, slash);
  const branch = ref.slice(slash + 1);
  if (slash < 1 || !(await git(path, ["remote"])).split("\n").includes(remote))
    throw new Error(`Starting ref does not exist: ${ref}`);

  await git(path, ["check-ref-format", `refs/heads/${branch}`]);
  await git(path, ["fetch", "--no-tags", remote, `refs/heads/${branch}:refs/remotes/${remote}/${branch}`], { signal });

  return await git(path, ["rev-parse", "--verify", `${ref}^{commit}`]);
};

export const checkoutBranch = async (
  path: string,
  ref: string,
  config: Config,
  signal?: AbortSignal,
): Promise<Snapshot> => {
  const commit = await startingCommit(path, ref, signal);

  await git(path, ["checkout", "--detach", "--force", commit], { signal });
  await git(path, ["clean", "-ffd"], { signal });

  const local = await git(path, ["show-ref", "--verify", "--hash", `refs/heads/${ref}`], { allowFailure: true });
  if (local === commit) await git(path, ["symbolic-ref", "HEAD", `refs/heads/${ref}`]);

  await pruneIgnored(path, config);
  return await capture(path, config, signal);
};

export const checkoutLocal = async (
  path: string,
  baseline: Snapshot,
  config: Config,
  signal?: AbortSignal,
): Promise<Snapshot> => {
  if (baseline.branch) await git(path, ["symbolic-ref", "HEAD", `refs/heads/${baseline.branch}`]);

  await pruneIgnored(path, config);
  if (!sameSnapshot(baseline, await capture(path, config, signal)))
    throw new Error(`Source changed during copying. Workspace retained at ${path}; delete it and retry.`);

  return baseline;
};
