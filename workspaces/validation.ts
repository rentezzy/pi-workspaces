import { CATALOG_VALIDATOR, LOCK_OWNER_VALIDATOR, WORKSPACE_NAME_PATTERN } from "./constants.ts";
import type { Catalog, LockOwner } from "./types.ts";

export const validateCatalog: (value: unknown) => asserts value is Catalog = value => {
  if (!CATALOG_VALIDATOR(value)) throw new Error("Invalid workspace catalog (schema/version mismatch)");

  const catalog = value as Catalog;
  const duplicates = [catalog.projects, catalog.workspaces, catalog.operations].some(
    entries => new Set(entries.map(entry => entry.id)).size !== entries.length,
  );

  if (duplicates) throw new Error("Invalid workspace catalog (duplicate IDs)");
};

export const isLockOwner = (value: unknown): value is LockOwner => LOCK_OWNER_VALIDATOR(value);

export const validateWorkspaceName = (name: string, catalog: Catalog, projectId: string): void => {
  if (!WORKSPACE_NAME_PATTERN.test(name))
    throw new Error("Name must be 1–80 letters, numbers, dots, dashes or underscores.");

  if (
    catalog.workspaces.some(
      workspace => workspace.projectId === projectId && workspace.name === name && workspace.status !== "missing",
    )
  )
    throw new Error("A workspace with this name already exists.");
};
