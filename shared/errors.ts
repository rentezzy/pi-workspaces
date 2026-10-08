import type { TryCatchResult } from "./types.ts";

export const tryCatch = async <T>(promise: PromiseLike<T>): Promise<TryCatchResult<T>> => {
  try {
    return { data: await promise, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
};
