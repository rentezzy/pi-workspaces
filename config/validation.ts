import { expand } from "../shared/fs.ts";
import { nonempty, array } from "../shared/validation.ts";
import { HOOK_PHASES, VALID_SETTINGS } from "./constants.ts";
import type { Config, HookPhase } from "./types.ts";

const parseHooks = (hooks: Config["hooks"]): Config["hooks"] =>
  Object.fromEntries(
    Object.entries(hooks).map(([phase, commands]) => {
      if (!HOOK_PHASES.includes(phase as HookPhase) || !(nonempty(commands) || array(nonempty)(commands)))
        throw new Error(`Invalid hook: ${phase}`);

      return [phase, typeof commands === "string" ? [commands] : [...commands]];
    }),
  );

export const parseSettings = (value: unknown): Partial<Config> => {
  if (!VALID_SETTINGS(value)) throw new Error("Unknown setting or invalid config type.");

  const settings = value as Partial<Config>;
  if (settings.root !== undefined) expand(settings.root);
  if (settings.executable !== undefined) expand(settings.executable);

  return { ...settings, ...(settings.hooks ? { hooks: parseHooks(settings.hooks) } : {}) };
};
