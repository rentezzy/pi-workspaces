export const USAGE = [
  "/workspace [panel|list|configure]",
  "/workspace create [NAME] [--from WORKSPACE] [--strategy local|branch] [--ref REF] [--no-hooks]",
  "/workspace delete WORKSPACE [--force] [--no-hooks]",
  "/workspace merge SOURCE [--into TARGET] [--mode active|passive] [--resume OPERATION] [--no-hooks]",
  "Quote names and paths with spaces. Workspace selectors are names, ids, or paths.",
].join("\n");

export const SUBCOMMANDS = ["panel", "create", "list", "merge", "delete", "configure", "help"];

export const SIMPLE_COMMANDS = ["panel", "list", "configure", "help"];

export const ALLOWED_FLAGS: Record<string, string[]> = {
  create: ["from", "strategy", "ref", "no-hooks"],
  delete: ["force", "no-hooks"],
  merge: ["into", "mode", "resume", "no-hooks"],
};

export const BOOLEAN_FLAGS = ["force", "no-hooks"];
export const DOUBLE_QUOTE_ESCAPES = ['"', "\\", "$", "`", "\n"];
export const REF_COMPLETION_PATTERN = /^(.*\s--ref(?:=|\s+))([^\s]*)$/;
