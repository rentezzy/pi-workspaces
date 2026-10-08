import { lstat, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { PRIVATE_DIRECTORY_MODE } from "../shared/constants.ts";
import { tryCatch } from "../shared/errors.ts";
import { readRegular, atomicJSON, isError } from "../shared/fs.ts";
import { configurationFiles, defaultConfig, settingsOverlay } from "./utils.ts";
import { parseSettings } from "./validation.ts";
import type { Config } from "./types.ts";

export const readSettings = async (path: string): Promise<Partial<Config>> => {
  const { data: contents, error: readError } = await tryCatch(readRegular(path));
  if (isError(readError, "ENOENT")) return {};
  if (readError) throw readError;

  try {
    return parseSettings(JSON.parse(contents));
  } catch (error) {
    throw new Error(
      `Invalid workspace configuration: ${path}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};

export const saveSettings = async (path: string, settings: Partial<Config>): Promise<void> => {
  const value = parseSettings(settings);
  const directory = dirname(path);

  await mkdir(directory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  if (!(await lstat(directory)).isDirectory())
    throw new Error(`Configuration directory is not a regular directory: ${directory}`);

  await atomicJSON(path, value);
};

export const loadConfig = async (
  agentDir: string,
  origin: string,
  trusted: boolean,
  pending?: { path: string; settings: Partial<Config> },
): Promise<Config> => {
  const files = configurationFiles(agentDir, origin, trusted);

  return await files.reduce<Promise<Config>>(async (previous, path) => {
    const config = await previous;
    const { data: overrides, error } = await tryCatch(
      path === pending?.path ? Promise.resolve(pending.settings) : readSettings(path),
    );
    if (error) throw new Error(`Invalid workspace configuration: ${path}`, { cause: error });

    return settingsOverlay(config, overrides, path);
  }, Promise.resolve(defaultConfig()));
};
