import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { mergeSummary, workspaceSummary } from "../ui/utils.ts";
import { TOOL_NAMESPACE, OUTPUT_SCHEMA, HOOKS_SCHEMA, STRATEGY_SCHEMA, MODE_SCHEMA } from "./constants.ts";
import { selector, publicWorkspace, toolResult } from "./utils.ts";
import type { WorkspaceToolActions } from "./types.ts";

export const registerMutationTools = (pi: ExtensionAPI, actions: WorkspaceToolActions): void => {
  const { create, remove, merge } = actions;

  pi.registerTool({
    name: "workspace_create",
    label: "Create workspace",
    namespace: TOOL_NAMESPACE,
    outputSchema: OUTPUT_SCHEMA,
    executionMode: "sequential",
    description:
      "Create an independent Git repository copy. Generates a human-readable space-themed name by default. Does not switch directories or launch a session.",
    parameters: Type.Object(
      {
        name: Type.Optional(selector("Optional workspace name; omitted names are generated, e.g. enormous-planet.")),
        from: Type.Optional(selector("Source workspace name, id, or path; defaults to here.")),
        strategy: Type.Optional(STRATEGY_SCHEMA),
        ref: Type.Optional(selector("Starting Git ref for branch strategy; defaults to configured baseBranch (main).")),
        hooks: HOOKS_SCHEMA,
      },
      { additionalProperties: false },
    ),
    execute: async (_id, params, signal, _onUpdate, ctx) => {
      const workspace = await create(ctx, params, signal);
      return toolResult(publicWorkspace(workspace), workspaceSummary("Created", workspace));
    },
  });

  pi.registerTool({
    name: "workspace_delete",
    label: "Delete workspace",
    namespace: TOOL_NAMESPACE,
    outputSchema: OUTPUT_SCHEMA,
    executionMode: "sequential",
    description:
      "Delete a managed workspace copy. Dirty copies require force. No mandatory confirmation dialog; service safety checks still apply.",
    parameters: Type.Object(
      {
        workspace: selector("Workspace name, id, or path to delete."),
        force: Type.Optional(Type.Boolean({ description: "Allow deleting a dirty workspace (default false)." })),
        hooks: HOOKS_SCHEMA,
      },
      { additionalProperties: false },
    ),
    execute: async (_id, params, signal, _onUpdate, ctx) => {
      const workspace = await remove(ctx, params, signal);
      return toolResult(publicWorkspace(workspace), workspaceSummary("Deleted", workspace));
    },
  });

  pi.registerTool({
    name: "workspace_merge",
    label: "Merge workspace",
    namespace: TOOL_NAMESPACE,
    outputSchema: OUTPUT_SCHEMA,
    executionMode: "sequential",
    description:
      "Integrate source into target (current workspace by default) in active or passive mode. Private rebase conflicts return an operation id, integration path, and instructions; supply resume after resolving them.",
    parameters: Type.Object(
      {
        source: selector("Source workspace name, id, or path."),
        target: Type.Optional(selector("Target workspace name, id, or path; defaults to here.")),
        mode: Type.Optional(MODE_SCHEMA),
        resume: Type.Optional(selector("Operation id to resume after resolving private integration conflicts.")),
        hooks: HOOKS_SCHEMA,
      },
      { additionalProperties: false },
    ),
    execute: async (_id, params, signal, _onUpdate, ctx) => {
      const result = await merge(ctx, params, signal);
      return toolResult(result, mergeSummary(result));
    },
  });
};
