import { object, integer, nonempty, string, number, oneOf, array, map } from "../shared/validation.ts";

export const WORKSPACE_MARKER = ".pi-workspace";
export const CATALOG_FILE = "catalog.json";
export const SESSION_DIRECTORIES_FILE = "session-directories.json";
export const LOCK_DIRECTORY = ".lock";
export const LOCK_WAIT_MS = 50;
export const UNOWNED_LOCK_TIMEOUT_MS = 5000;
export const WORKSPACE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;

export const WORKSPACE_ADJECTIVES = [
  "enormous",
  "tiny",
  "distant",
  "silent",
  "radiant",
  "luminous",
  "cosmic",
  "stellar",
  "solar",
  "lunar",
  "ancient",
  "wandering",
  "orbiting",
  "glowing",
  "icy",
  "fiery",
  "golden",
  "silver",
  "violet",
  "azure",
  "bright",
  "hidden",
  "swift",
  "infinite",
];

export const WORKSPACE_NOUNS = [
  "planet",
  "comet",
  "nebula",
  "galaxy",
  "moon",
  "star",
  "asteroid",
  "meteor",
  "quasar",
  "pulsar",
  "supernova",
  "constellation",
  "cosmos",
  "satellite",
  "orbit",
  "eclipse",
  "aurora",
  "nova",
  "stardust",
  "horizon",
  "void",
  "cluster",
  "sun",
  "crater",
];

const SNAPSHOT = object({
  head: string,
  branch: value => value === null || string(value),
  branches: map(string),
  headTree: string,
  indexTree: string,
  workTree: string,
});

const PROJECT = object({ id: nonempty, origin: nonempty, slug: nonempty, rootId: nonempty });

const WORKSPACE = object(
  {
    id: nonempty,
    projectId: nonempty,
    name: nonempty,
    location: value =>
      object({ kind: oneOf("local"), path: nonempty })(value) ||
      object({ kind: oneOf("remote"), connection: nonempty, path: nonempty })(value),
    createdAt: number,
    trusted: value => typeof value === "boolean",
    status: oneOf("ready", "setup-failed", "missing"),
  },
  { parentId: nonempty, baseline: SNAPSHOT, marker: string },
);

const RECEIPT = object({
  sourceId: nonempty,
  targetId: nonempty,
  branches: map(object({ source: string, result: string })),
  source: SNAPSHOT,
  createdAt: number,
});

const PLAN = object({ name: nonempty, incoming: string }, { old: string, result: string, base: string });

const OPERATION = object(
  {
    id: nonempty,
    sourceId: nonempty,
    targetId: nonempty,
    mode: oneOf("active", "passive"),
    path: nonempty,
    state: oneOf("preparing", "branch-conflict", "publishing", "recovery-required", "complete", "failed"),
    source: SNAPSHOT,
    target: SNAPSHOT,
    baseline: SNAPSHOT,
    plans: array(PLAN),
  },
  {
    current: integer,
    error: string,
    conflicts: array(string),
    resultTree: string,
    resultIndex: string,
    resultHead: string,
    resultBranch: value => value === null || string(value),
  },
);

export const CATALOG_VALIDATOR = object({
  version: oneOf(1),
  projects: array(PROJECT),
  workspaces: array(WORKSPACE),
  receipts: array(RECEIPT),
  operations: array(OPERATION),
});

export const LOCK_OWNER_VALIDATOR = object({
  pid: value => integer(value) && (value as number) > 0,
  token: value => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value),
  host: nonempty,
});
