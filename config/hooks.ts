import { run } from "../shared/process.ts";
import { tryCatch } from "../shared/errors.ts";
import type { Config, HookPhase } from "./types.ts";

export const runHooks = async (
  config: Config,
  phase: HookPhase,
  cwd: string,
  env: NodeJS.ProcessEnv,
  signal?: AbortSignal,
): Promise<void> => {
  signal?.throwIfAborted();

  for (const [index, command] of (config.hooks[phase] ?? []).entries()) {
    signal?.throwIfAborted();

    const { error } = await tryCatch(
      run("/bin/sh", ["-c", command], {
        cwd,
        env: { ...env, WORKSPACE_PHASE: phase },
        signal,
      }),
    );
    if (error) throw new Error(`Workspace ${phase} hook ${index + 1} failed`, { cause: error });

    signal?.throwIfAborted();
  }
};
