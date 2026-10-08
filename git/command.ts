import { decode, run } from "../shared/process.ts";
import type { ProcessOptions } from "../shared/types.ts";
import { FINAL_NEWLINE_PATTERN, GIT_OPTIONS } from "./constants.ts";

export const git = async (cwd: string, args: string[], options: ProcessOptions = {}): Promise<string> => {
  const result = await run("git", [...GIT_OPTIONS, ...args], { ...options, cwd });
  return decode(result.stdout).replace(FINAL_NEWLINE_PATTERN, "");
};
