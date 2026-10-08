import { truncateHead, type AgentToolResult } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { workspacePath } from "../ui/utils.ts";
import type { WorkspaceView } from "../workspaces/types.ts";

export const selector = (description: string) => Type.String({ minLength: 1, description });

export const publicWorkspace = (workspace: WorkspaceView) => ({
  id: workspace.id,
  name: workspace.name,
  path: workspacePath(workspace),
  projectId: workspace.projectId,
  parentId: workspace.parentId,
  status: workspace.status,
  branch: workspace.branch,
  dirty: workspace.dirty,
  error: workspace.error,
});

export const toolResult = <T extends object>(data: T, text: string): AgentToolResult<T> => {
  const summary = truncateHead(text);

  return {
    content: [
      {
        type: "text",
        text: summary.content + (summary.truncated ? "\n[Text truncated; complete data is in structuredContent.]" : ""),
      },
    ],
    details: data,
    structuredContent: JSON.parse(JSON.stringify(data)),
  };
};
