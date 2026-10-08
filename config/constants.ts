import { object, nonempty, oneOf, array, record } from "../shared/validation.ts";
import type { Config, HookPhase } from "./types.ts";

export const VALID_SETTINGS = object(
  {},
  {
    root: nonempty,
    executable: nonempty,
    baseBranch: nonempty,
    defaultStrategy: oneOf("local", "branch"),
    transferNotice: oneOf(true, false),
    exclude: array(nonempty),
    hooks: record,
  },
);

export const CONFIG_FILE = "workspaces.json";
export const PROJECT_CONFIG_DIRECTORY = ".pi";

export const HOOK_PHASES = [
  "preCreate",
  "postCreate",
  "preDelete",
  "postDelete",
  "preMerge",
  "postMerge",
] as const satisfies readonly HookPhase[];

export const DEFAULT_CONFIG: Config = {
  root: "~/.worktrees",
  executable: "rift",
  baseBranch: "main",
  defaultStrategy: "local",
  transferNotice: true,
  exclude: [
    "node_modules/**",
    "**/node_modules/**",
    ".venv/**",
    "venv/**",
    "**/__pycache__/**",
    ".cache/**",
    ".pytest_cache/**",
    ".mypy_cache/**",
    ".ruff_cache/**",
    ".next/**",
    ".nuxt/**",
    ".turbo/**",
    "dist/**",
    "build/**",
    "coverage/**",
    "target/**",
  ],
  hooks: {},
};
