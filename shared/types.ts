export type TryCatchResult<T> = { data: T; error: null } | { data: null; error: Error };

export type Check = (value: unknown) => boolean;

export interface CommandResult {
  code: number;
  stdout: Buffer;
  stderr: string;
}

export interface ProcessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  input?: string | Buffer;
  allowFailure?: boolean;
}

export interface ProcessOutput {
  chunks: Buffer[];
  stderr: string;
  bytes: number;
  failure?: Error;
}
