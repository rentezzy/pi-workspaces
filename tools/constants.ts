import { Type } from "typebox";
import { HOOK_PHASES } from "../config/constants.ts";
import { selector } from "./utils.ts";

export const TOOL_NAMESPACE = {
  name: "workspaces",
  description: "Manage and configure independent Git repository copies.",
  instructions:
    "Use workspace_list to discover workspace names, ids, and paths. Operations use the current project " +
    "without changing cwd or managing Pi sessions. Create uses the configured defaultStrategy and generates " +
    "a space-themed name unless supplied. Branch strategy starts at ref (configured baseBranch by default). " +
    "Merge source into the current workspace, or supply target. For private rebase conflicts, follow the returned " +
    "instructions and retry with the operation id in resume. workspace_configure reads or updates project " +
    "defaults shared by related workspaces, or profile defaults. Hooks may execute trusted configuration; hooks:false skips them.",
};

export const OUTPUT_SCHEMA = Type.Object({}, { additionalProperties: true });
export const HOOKS_SCHEMA = Type.Optional(
  Type.Boolean({ description: "Run configured lifecycle hooks (default true)." }),
);
export const STRATEGY_SCHEMA = Type.Union([Type.Literal("local"), Type.Literal("branch")]);
export const MODE_SCHEMA = Type.Union([Type.Literal("active"), Type.Literal("passive")]);

export const SETTINGS_SCHEMA = Type.Object(
  {
    root: Type.Optional(
      selector("Storage root, e.g. ~/.worktrees. Relative paths resolve against the configuration file."),
    ),
    executable: Type.Optional(selector("Rift executable name or path.")),
    defaultStrategy: Type.Optional(STRATEGY_SCHEMA),
    transferNotice: Type.Optional(
      Type.Boolean({ description: "Append a hidden model-visible notice when transferring a session (default true)." }),
    ),
    baseBranch: Type.Optional(selector("Default existing starting ref for branch copies, e.g. main or origin/main.")),
    exclude: Type.Optional(
      Type.Array(Type.String({ minLength: 1 }), {
        description: "Replace default artifact exclusion globs; Git ignore rules still apply.",
      }),
    ),
    hooks: Type.Optional(
      Type.Object(
        Object.fromEntries(HOOK_PHASES.map(phase => [phase, Type.Optional(Type.Array(Type.String({ minLength: 1 })))])),
        {
          additionalProperties: false,
          description: "Hook command arrays, patched by phase. An empty array disables that phase.",
        },
      ),
    ),
  },
  { additionalProperties: false },
);
