import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { oneLine, workspaceLine, workspacePath } from "../ui/utils.ts";
import type { WorkspaceService } from "../workspaces/service.ts";
import { TOOL_NAMESPACE, OUTPUT_SCHEMA, SETTINGS_SCHEMA } from "./constants.ts";
import { publicWorkspace, toolResult } from "./utils.ts";
import type { WorkspaceToolActions } from "./types.ts";
import { registerMutationTools } from "./mutations.ts";

export const registerWorkspaceTools = (
  pi: ExtensionAPI,
  service: WorkspaceService,
  actions: WorkspaceToolActions,
): void => {
  const { configure, showViews } = actions;

  registerMutationTools(pi, actions);

  pi.registerTool({
    name: "workspace_list",
    label: "List workspaces",
    namespace: TOOL_NAMESPACE,
    outputSchema: OUTPUT_SCHEMA,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    description: "List this project's workspaces, including names, ids, paths, branches, local changes, and errors.",
    parameters: Type.Object({}, { additionalProperties: false }),
    execute: async (_id, _params, signal, _onUpdate, ctx) => {
      const workspaces = await service.list(ctx.cwd, signal);
      await showViews(ctx, workspaces);
      return toolResult(
        { workspaces: workspaces.map(publicWorkspace) },
        workspaces.length
          ? workspaces
              .map(workspace => `${workspaceLine(workspace)}\n  ${oneLine(workspacePath(workspace))} [${workspace.id}]`)
              .join("\n")
          : "No workspaces.",
      );
    },
  });

  pi.registerTool({
    name: "workspace_configure",
    label: "Configure workspaces",
    namespace: TOOL_NAMESPACE,
    outputSchema: OUTPUT_SCHEMA,
    executionMode: "sequential",
    annotations: { destructiveHint: false, openWorldHint: false },
    description:
      "Read workspace configuration or persist a settings patch. Project scope applies to the trusted origin and all related workspaces; profile scope supplies defaults for all projects. Returns saved overrides and effective defaults at that scope. Does not run hooks.",
    parameters: Type.Object(
      {
        scope: Type.Optional(
          Type.Union([Type.Literal("project"), Type.Literal("profile")], {
            description: "Configuration scope; defaults to project.",
          }),
        ),
        settings: Type.Optional(SETTINGS_SCHEMA),
        reset: Type.Optional(
          Type.Boolean({ description: "Clear all overrides at this scope before applying settings (default false)." }),
        ),
      },
      { additionalProperties: false },
    ),
    execute: async (_id, params, signal, _onUpdate, ctx) => {
      const config = await configure(ctx, params, signal);
      return toolResult(config, JSON.stringify(config, null, 2));
    },
  });
};
