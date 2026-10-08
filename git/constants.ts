import { WORKSPACE_MARKER } from "../workspaces/constants.ts";
import type { MergeMode } from "./types.ts";

export const GIT_DIRECTORY = ".git";
export const RIFT_DIRECTORY = ".rift";
export const WORKSPACE_MARKERS = [RIFT_DIRECTORY, WORKSPACE_MARKER];
export const GIT_OPERATION_PATHS = [
  "index.lock",
  "HEAD.lock",
  "packed-refs.lock",
  "config.lock",
  "MERGE_HEAD",
  "CHERRY_PICK_HEAD",
  "REVERT_HEAD",
  "BISECT_LOG",
  "rebase-merge",
  "rebase-apply",
  "sequencer",
];
export const REBASE_PATHS = ["rebase-merge", "rebase-apply"];
export const HOOKS_DISABLED_OPTIONS = ["-c", "core.hooksPath=/dev/null"];
export const GIT_OPTIONS = [
  ...HOOKS_DISABLED_OPTIONS,
  "-c",
  "core.fsmonitor=false",
  "-c",
  "core.untrackedCache=false",
  "-c",
  "commit.gpgSign=false",
];
export const REBASE_OPTIONS = [...HOOKS_DISABLED_OPTIONS, "-c", "commit.gpgSign=false", "rebase"];
export const WORKSPACE_REFS = "refs/pi-workspaces";
export const SNAPSHOT_REFS = `${WORKSPACE_REFS}/snapshots`;
export const PUBLISH_REF = `${WORKSPACE_REFS}/publish`;
export const IMPORT_REFS = `${WORKSPACE_REFS}/imports`;
export const TARGET_SNAPSHOTS = "target-snapshots";
export const SOURCE_SNAPSHOTS = "source-snapshots";
export const INDEX_TEMP_PREFIX = "pi-workspace-index-";
export const IGNORE_TEMP_PREFIX = "pi-workspace-ignore-";
export const FILE_TEMP_PREFIX = ".pi-workspace-";
export const SNAPSHOT_MESSAGE = "Internal workspace snapshot\n";
export const OBJECT_ID_PATTERN = /^[a-f0-9]{40,64}$/;
export const FINAL_NEWLINE_PATTERN = /\r?\n$/;
export const TRAILING_SLASH_PATTERN = /\/$/;
export const SUBMODULE_TREE_MODE = "160000";
export const SYMLINK_TREE_MODE = "120000";
export const EXECUTABLE_TREE_MODE = "100755";
export const EXECUTABLE_FILE_MODE = 0o755;
export const REGULAR_FILE_MODE = 0o644;
export const DEFAULT_MERGE_MODE: MergeMode = "passive";
export const SNAPSHOT_IDENTITY = {
  GIT_AUTHOR_NAME: "Pi Workspaces",
  GIT_AUTHOR_EMAIL: "workspace@localhost",
  GIT_COMMITTER_NAME: "Pi Workspaces",
  GIT_COMMITTER_EMAIL: "workspace@localhost",
  GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
  GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
};
