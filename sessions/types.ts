import type {
  ExtensionCommandContext,
  ExtensionContext,
  SessionEntry,
  SessionHeader,
  SessionInfo,
} from "@earendil-works/pi-coding-agent";
import type { Configuration } from "../config/types.ts";
import type { CreateOptions, Workspace } from "../workspaces/types.ts";

export class SessionIdentityError extends Error {}

export interface SessionSelection {
  model?: { provider: string; id: string };
  thinkingLevel?: ExtensionContext["thinkingLevel"];
}

export interface SessionBinding {
  version: 1;
  sessionId: string;
  projectId: string;
  workspaceId: string;
  conversationId: string;
  cwd: string;
  predecessor?: { sessionId: string; path: string; history: string };
  selection?: SessionSelection;
}

export interface SessionBindingInspection {
  binding?: SessionBinding;
  issue?: string;
}

export interface SessionSnapshot {
  header: SessionHeader;
  entries: SessionEntry[];
  leafId: string | null;
  path?: string;
}

export interface SessionPrepareOptions {
  recoverBinding?: boolean;
  savedSelection?: boolean;
}

export interface WorkspaceSession extends SessionInfo {
  binding?: SessionBinding;
  projectId?: string;
  workspaceId?: string;
  workspaceName: string;
  projectName: string;
  history: string;
  active: boolean;
  checkpoint: boolean;
  issue?: string;
}

export type SessionGrouping = "session" | "workspace";

export interface SessionFilter {
  projectOnly: boolean;
  history: boolean;
  query: string;
}

export interface SessionGroup {
  key: string;
  label: string;
  sessions: WorkspaceSession[];
}

export interface SessionRow {
  label: string;
  prefix: string;
  session?: WorkspaceSession;
  current?: boolean;
}

export interface TreeNode {
  session: WorkspaceSession;
  children: TreeNode[];
  parent?: TreeNode;
  latest: number;
  current: boolean;
}

export interface SessionNavigationActions {
  create: (ctx: ExtensionCommandContext, options: CreateOptions) => Promise<Workspace>;
  configure: (ctx: ExtensionCommandContext) => Promise<Configuration>;
}
