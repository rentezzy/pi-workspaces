import { spawn } from "node:child_process";
import { COMMAND_OUTPUT_LIMIT, COMMAND_STDERR_LIMIT, GIT_ENVIRONMENT } from "./constants.ts";
import type { CommandResult, ProcessOptions, ProcessOutput } from "./types.ts";

export const decode = (buffer: Buffer): string =>
  new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer);

const commandEnvironment = (command: string, extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  if (command !== "git") return { ...process.env, ...extra };

  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  return { ...inherited, ...GIT_ENVIRONMENT, ...extra };
};

const commandError = (command: string, args: string[], result: CommandResult): Error =>
  new Error(
    `${command} ${args.slice(0, 3).join(" ")}: ${result.stderr.trim() || result.stdout.toString().trim() || "failed"}`,
  );

export const run = async (command: string, args: string[], options: ProcessOptions = {}): Promise<CommandResult> => {
  options.signal?.throwIfAborted();

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: commandEnvironment(command, options.env),
      stdio: ["pipe", "pipe", "pipe"],
    });
    const output: ProcessOutput = { chunks: [], stderr: "", bytes: 0 };
    const abort = () => {
      output.failure = new Error("Workspace operation cancelled");
      child.kill("SIGTERM");
    };

    options.signal?.addEventListener("abort", abort, { once: true });

    child.on("error", error => {
      options.signal?.removeEventListener("abort", abort);
      reject(error);
    });

    child.stdin.on("error", error => {
      if ((error as NodeJS.ErrnoException).code !== "EPIPE") output.failure = error;
    });

    child.stdout.on("data", (chunk: Buffer) => {
      output.bytes += chunk.length;
      if (output.bytes <= COMMAND_OUTPUT_LIMIT) {
        output.chunks.push(chunk);
        return;
      }

      output.failure = new Error("Workspace command output exceeds 128 MiB");
      child.kill();
    });

    child.stderr.on("data", chunk => {
      output.stderr = (output.stderr + chunk.toString()).slice(-COMMAND_STDERR_LIMIT);
    });

    child.on("close", code => {
      options.signal?.removeEventListener("abort", abort);

      const result = { code: code ?? -1, stdout: Buffer.concat(output.chunks), stderr: output.stderr };
      if (output.failure) return reject(output.failure);
      if (result.code && !options.allowFailure) return reject(commandError(command, args, result));

      resolve(result);
    });

    child.stdin.end(options.input);
  });
};
