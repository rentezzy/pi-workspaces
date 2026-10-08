import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PRIVATE_DIRECTORY_MODE } from "../shared/constants.ts";
import { tryCatch } from "../shared/errors.ts";
import { expand, readRegular, atomicJSON, isError } from "../shared/fs.ts";
import { CATALOG_FILE } from "./constants.ts";
import { acquireRegistryLock } from "./lock.ts";
import { emptyCatalog } from "./utils.ts";
import { validateCatalog } from "./validation.ts";
import type { Catalog, RegistryLock } from "./types.ts";

const runOperation = async <T>(
  catalog: Catalog,
  operation: (catalog: Catalog) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> => {
  const result = await operation(catalog);
  signal?.throwIfAborted();

  return result;
};

export class Registry {
  readonly directory: string;

  constructor(directory: string) {
    this.directory = resolve(expand(directory));
  }

  read = async (): Promise<Catalog> => {
    const path = join(this.directory, CATALOG_FILE);
    const { data: contents, error } = await tryCatch(readRegular(path));

    if (isError(error, "ENOENT")) return emptyCatalog();
    if (error) throw error;

    try {
      const value: unknown = JSON.parse(contents);
      validateCatalog(value);
      return value;
    } catch (error) {
      throw new Error(`Corrupt workspace catalog: ${path}`, { cause: error });
    }
  };

  save = async (catalog: Catalog): Promise<void> => {
    const value: unknown = JSON.parse(JSON.stringify(catalog));
    validateCatalog(value);

    await mkdir(this.directory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
    await atomicJSON(join(this.directory, CATALOG_FILE), value);
  };

  private transaction = async <T>(
    lock: RegistryLock,
    operation: (catalog: Catalog) => Promise<T>,
    signal?: AbortSignal,
  ) => {
    const catalog = await this.read();
    signal?.throwIfAborted();

    const result = await tryCatch(runOperation(catalog, operation, signal));
    const { error: saveError } = await tryCatch(lock.verify().then(() => this.save(catalog)));

    return { result, saveError };
  };

  locked = async <T>(operation: (catalog: Catalog) => Promise<T>, signal?: AbortSignal): Promise<T> => {
    const lock = await acquireRegistryLock(this.directory, signal);
    const outcome = await tryCatch(this.transaction(lock, operation, signal));
    const release = await tryCatch(lock.release());
    const errors = [outcome.error, outcome.data?.result.error, outcome.data?.saveError, release.error].filter(
      (error): error is Error => error !== null && error !== undefined,
    );

    if (errors.length === 1) throw errors[0];
    if (errors.length > 1)
      throw new AggregateError(errors, "Workspace operation, journal save, or lock release failed");
    signal?.throwIfAborted();

    return outcome.data!.result.data as T;
  };
}
