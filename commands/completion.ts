import type { AutocompleteItem } from "@earendil-works/pi-tui";
import { tryCatch } from "../shared/errors.ts";
import type { WorkspaceService } from "../workspaces/service.ts";
import { SUBCOMMANDS, REF_COMPLETION_PATTERN } from "./constants.ts";
import { parseCommand } from "./parser.ts";

const referenceCompletions = async (
  service: WorkspaceService,
  cwd: string,
  ref: RegExpExecArray,
): Promise<AutocompleteItem[] | null> => {
  const command = parseCommand(ref[1] + "HEAD");
  if (command.verb !== "create") return null;

  const branches = await service.branches(cwd, command.options.from);
  const matches = branches
    .filter(branch => branch.toLowerCase().startsWith(ref[2]!.toLowerCase()))
    .map(branch => ({ value: ref[1] + branch, label: branch }));

  return matches.length ? matches : null;
};

export const commandCompletions = async (
  service: WorkspaceService,
  cwd: string,
  prefix: string,
): Promise<AutocompleteItem[] | null> => {
  if (!/\s/.test(prefix)) {
    const matches = SUBCOMMANDS.filter(command => command.startsWith(prefix)).map(value => ({ value, label: value }));

    return matches.length ? matches : null;
  }

  const ref = REF_COMPLETION_PATTERN.exec(prefix);
  if (!ref) return null;

  const { data } = await tryCatch(referenceCompletions(service, cwd, ref));
  return data;
};
