import { HOOK_PHASES } from "../config/constants.ts";
import type { Configuration } from "../config/types.ts";
import { BACK_ITEM, SETTINGS_ITEMS } from "./constants.ts";
import type { MenuItem } from "./types.ts";
import { oneLine } from "./utils.ts";

export const settingsOptions = (config: Configuration): MenuItem[] => {
  const descriptions: Record<string, string> = {
    strategy: config.effective.defaultStrategy,
    branch: oneLine(config.effective.baseBranch),
    root: oneLine(config.effective.root),
    executable: oneLine(config.effective.executable),
    exclude: `${config.effective.exclude.length} patterns`,
    transferNotice: config.effective.transferNotice ? "Enabled" : "Disabled",
  };
  return SETTINGS_ITEMS.map(item => ({ ...item, description: descriptions[item.value] }));
};

export const hookOptions = (config: Configuration): MenuItem[] => [
  ...HOOK_PHASES.map(phase => ({
    value: phase,
    label: phase,
    description: `${config.effective.hooks[phase]?.length ?? 0} commands`,
  })),
  BACK_ITEM,
];
