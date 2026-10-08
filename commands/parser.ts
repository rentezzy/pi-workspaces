import { USAGE, SIMPLE_COMMANDS, ALLOWED_FLAGS } from "./constants.ts";
import { splitArgs } from "./tokenize.ts";
import { parseFlags } from "./flags.ts";
import type { Command } from "./types.ts";

export const parseCommand = (input: string): Command => {
  const [verb = "panel", ...args] = splitArgs(input);
  if (SIMPLE_COMMANDS.includes(verb)) {
    if (args.length) throw new Error(`${verb} takes no arguments.\n${USAGE}`);
    return { verb: verb as "panel" | "list" | "configure" | "help" };
  }

  if (!Object.hasOwn(ALLOWED_FLAGS, verb)) throw new Error(USAGE);

  const { flags, positional } = parseFlags(verb, args);
  if (
    positional.length > 1 ||
    (positional.length === 1 && !positional[0]?.trim()) ||
    (verb !== "create" && positional.length !== 1)
  )
    throw new Error(
      `${verb === "create" ? "create accepts an optional name" : `${verb} requires exactly one workspace`}.\n${USAGE}`,
    );

  const name = positional[0];
  const hooks = flags["no-hooks"] ? false : undefined;
  const value = (key: string) => flags[key] as string | undefined;

  if (verb === "create") {
    const strategy = value("strategy");
    if (strategy !== undefined && strategy !== "local" && strategy !== "branch")
      throw new Error("--strategy must be local or branch.");

    return { verb, options: { name, from: value("from"), strategy, ref: value("ref"), hooks } };
  }

  if (verb === "delete") return { verb, options: { workspace: name!, force: flags.force === true, hooks } };

  const mode = value("mode");
  if (mode !== undefined && mode !== "active" && mode !== "passive")
    throw new Error("--mode must be active or passive.");

  return { verb: "merge", options: { source: name!, target: value("into"), mode, resume: value("resume"), hooks } };
};
