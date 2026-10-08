import type { Strategy } from "../workspaces/types.ts";

export type HookPhase = "preCreate" | "postCreate" | "preDelete" | "postDelete" | "preMerge" | "postMerge";
export type ConfigScope = "project" | "profile";

export interface Config {
  root: string;
  executable: string;
  baseBranch: string;
  defaultStrategy: Strategy;
  transferNotice: boolean;
  exclude: string[];
  hooks: Partial<Record<HookPhase, string[]>>;
}

export interface ConfigureOptions {
  scope?: ConfigScope;
  settings?: Partial<Config>;
  reset?: boolean;
}

export interface Configuration {
  scope: ConfigScope;
  path: string;
  settings: Partial<Config>;
  effective: Config;
}
