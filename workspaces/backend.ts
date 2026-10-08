import { lstat, mkdir, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { expand, exists, isError } from "../shared/fs.ts";
import { nonempty } from "../shared/validation.ts";
import { tryCatch } from "../shared/errors.ts";
import { run } from "../shared/process.ts";
import type { Config } from "../config/types.ts";
import type { CopyBackend } from "./types.ts";

const overlaps = (parent: string, child: string): boolean => {
  const path = relative(parent, child);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
};

const committedError = (error: Error, path: string): Error =>
  Object.assign(
    new Error(`Workspace changes may have committed at ${path}; inspect before retrying: ${error.message}`, {
      cause: error,
    }),
    { committed: true, path },
  );

const directory = async (path: string): Promise<string> => {
  if (!(await lstat(path)).isDirectory()) throw new Error(`Expected a nonsymlink directory: ${path}`);
  return await realpath(path);
};

const futurePath = async (path: string): Promise<string> => {
  const { data, error } = await tryCatch(realpath(path));
  if (!error) return data;
  if (!isError(error, "ENOENT") || dirname(path) === path) throw error;
  if (await exists(path)) throw new Error(`Dangling destination symlink: ${path}`);

  return join(await futurePath(dirname(path)), basename(path));
};

const createCopy = async (
  source: string,
  root: string,
  name: string,
  expected: string,
  config: Config,
  signal?: AbortSignal,
): Promise<string> => {
  const result = await run(
    config.executable,
    ["create", source, "--into", root, "--name", name, "--copy-all", "--no-hooks"],
    { signal },
  );
  const returned = result.stdout.toString("utf8").trim();

  if (!isAbsolute(returned) || resolve(returned) !== expected)
    throw new Error(`Rift returned an unexpected destination: ${JSON.stringify(returned)} (expected ${expected})`);
  if ((await directory(expected)) !== expected) throw new Error("Rift destination is not the expected directory");
  signal?.throwIfAborted();

  return expected;
};

export class RiftBackend implements CopyBackend {
  create = async (from: string, into: string, name: string, config: Config, signal?: AbortSignal): Promise<string> => {
    signal?.throwIfAborted();
    if (
      !nonempty(name) ||
      name.trim() !== name ||
      name === "." ||
      name === ".." ||
      /[/\\\x00-\x1f\x7f]/.test(name) ||
      name.startsWith("-")
    )
      throw new Error("Invalid workspace name");

    const source = await directory(resolve(expand(from)));
    const root = await futurePath(resolve(expand(into)));
    const expected = join(root, name);

    if (overlaps(source, expected) || overlaps(expected, source) || overlaps(source, root))
      throw new Error("Workspace source and destination must not overlap");
    if (await exists(expected)) throw new Error(`Workspace destination already exists: ${expected}`);

    await mkdir(root, { recursive: true });
    if ((await directory(root)) !== root) throw new Error("Workspace destination changed");

    signal?.throwIfAborted();
    await run(config.executable, ["init", "--here", source], { signal });
    signal?.throwIfAborted();
    if (await exists(expected)) throw new Error(`Workspace destination already exists: ${expected}`);

    const { data, error } = await tryCatch(createCopy(source, root, name, expected, config, signal));
    if (!error) return data;
    if (await exists(expected)) throw committedError(error, expected);

    throw error;
  };

  remove = async (path: string, config: Config, signal?: AbortSignal): Promise<void> => {
    signal?.throwIfAborted();

    const source = await directory(resolve(expand(path)));
    const children = await run(config.executable, ["list", source], { signal });
    if (children.stdout.toString().trim()) throw new Error("Remove descendant Rift copies first.");

    const { error } = await tryCatch(run(config.executable, ["remove", source, "--no-hooks"], { signal }));
    if (error) {
      if (!(await exists(source))) throw committedError(error, source);
      throw error;
    }

    if (await exists(source))
      throw new Error(`Rift did not remove ${source}; refusing to force-delete a source/root workspace`);
    if (signal?.aborted) throw committedError(new Error("Workspace operation cancelled"), source);
  };
}
