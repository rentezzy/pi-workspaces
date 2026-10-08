import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { Config } from "../config/types.ts";
import { PRIVATE_FILE_MODE } from "../shared/constants.ts";
import { tryCatch } from "../shared/errors.ts";
import { isError } from "../shared/fs.ts";
import { decode, run } from "../shared/process.ts";
import { git } from "./command.ts";
import { GIT_DIRECTORY, IGNORE_TEMP_PREFIX, TRAILING_SLASH_PATTERN, WORKSPACE_MARKERS } from "./constants.ts";
import { safeParents, safePath } from "./paths.ts";

export const excludes = async (root: string, config: Config, directory: string): Promise<string> => {
  const existing = await git(root, ["config", "--path", "--get", "core.excludesFile"], { allowFailure: true });
  const { data, error } = existing
    ? await tryCatch(readFile(resolve(root, existing), "utf8"))
    : { data: "", error: null };
  if (error && !isError(error, "ENOENT")) throw error;

  const path = join(directory, "exclude");
  await writeFile(
    path,
    [data ?? "", ...WORKSPACE_MARKERS.map(marker => `/${marker}`), ...config.exclude].join("\n") + "\n",
    { mode: PRIVATE_FILE_MODE },
  );
  return path;
};

export const ignoreMarker = async (root: string): Promise<void> => {
  const file = join(root, GIT_DIRECTORY, "info", "exclude");
  await mkdir(dirname(file), { recursive: true });
  const { data, error } = await tryCatch(readFile(file, "utf8"));
  if (error && !isError(error, "ENOENT")) throw error;

  const text = WORKSPACE_MARKERS.reduce(
    (text, marker) => (text.split("\n").includes(`/${marker}`) ? text : `${text}\n/${marker}\n`),
    data ?? "",
  );
  await writeFile(file, text);
};

export const pruneIgnored = async (root: string, config: Config): Promise<void> => {
  const temporary = await mkdtemp(join(tmpdir(), IGNORE_TEMP_PREFIX));
  try {
    const ignore = await excludes(root, config, temporary);
    const result = await run(
      "git",
      [
        "-c",
        `core.excludesFile=${ignore}`,
        "ls-files",
        "--others",
        "--ignored",
        "--exclude-standard",
        "--directory",
        "-z",
      ],
      { cwd: root },
    );
    for (const path of decode(result.stdout).split("\0").filter(Boolean)) {
      if (WORKSPACE_MARKERS.includes(path)) continue;
      const trimmed = path.replace(TRAILING_SLASH_PATTERN, "");
      await safeParents(root, trimmed);
      await rm(safePath(root, trimmed), { recursive: true, force: true });
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
};
