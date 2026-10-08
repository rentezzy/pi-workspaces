import { dirname, join, resolve } from "node:path";
import { expand } from "../shared/fs.ts";
import { DEFAULT_CONFIG, CONFIG_FILE, PROJECT_CONFIG_DIRECTORY } from "./constants.ts";
import type { Config } from "./types.ts";

export const defaultConfig = (): Config => ({
  ...DEFAULT_CONFIG,
  root: expand(DEFAULT_CONFIG.root),
  exclude: [...DEFAULT_CONFIG.exclude],
  hooks: {},
});

export const configurationFiles = (agentDir: string, origin: string, trusted: boolean): string[] => [
  join(resolve(expand(agentDir)), CONFIG_FILE),
  ...(trusted ? [join(resolve(expand(origin)), PROJECT_CONFIG_DIRECTORY, CONFIG_FILE)] : []),
];

export const mergeSettings = (settings: Partial<Config>, patch: Partial<Config>): Partial<Config> => ({
  ...settings,
  ...patch,
  ...(patch.hooks ? { hooks: { ...settings.hooks, ...patch.hooks } } : {}),
});

export const settingsOverlay = (config: Config, overrides: Partial<Config>, path: string): Config => {
  const root = overrides.root === undefined ? config.root : resolve(dirname(path), expand(overrides.root));
  const executable = overrides.executable === undefined ? config.executable : expand(overrides.executable);
  const resolvedExecutable =
    overrides.executable !== undefined && /[/\\]/.test(executable) ? resolve(dirname(path), executable) : executable;

  return {
    ...config,
    ...overrides,
    root,
    executable: resolvedExecutable,
    hooks: { ...config.hooks, ...overrides.hooks },
  };
};
