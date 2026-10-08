import { sep } from "node:path";

export const within = (path: string, root: string): boolean => path === root || path.startsWith(root + sep);

export const unique = <T>(values: Iterable<T>): T[] => [...new Set(values)];
