import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { HOOK_PHASES } from "../config/constants.ts";
import type { Configuration, ConfigureOptions } from "../config/types.ts";
import { tryCatch } from "../shared/errors.ts";
import type { WorkspaceService } from "../workspaces/service.ts";
import { branchPicker } from "./branch-picker.ts";
import { BACK, SCOPE_CHOICES, STRATEGY_CHOICES } from "./constants.ts";
import { textInput } from "./input.ts";
import { listEditor } from "./list-editor.ts";
import { hookOptions, settingsOptions } from "./settings-options.ts";
import type { SettingsActions, SettingsPatch } from "./types.ts";
import { oneLine } from "./utils.ts";

export class SettingsPanel {
  constructor(
    private ctx: ExtensionContext,
    private service: WorkspaceService,
    private actions: SettingsActions,
  ) {}

  show = async (): Promise<void> => {
    while (!this.ctx.signal?.aborted) {
      const scope = await this.actions.select("Configuration scope", SCOPE_CHOICES);
      if (!scope || scope === BACK) return;
      const options: ConfigureOptions = { scope: scope === "Profile" ? "profile" : "project" };
      const { error } = await tryCatch(this.settings(options));
      if (error) this.actions.report(error);
    }
  };

  private hooks = async (options: ConfigureOptions): Promise<void> => {
    while (!this.ctx.signal?.aborted) {
      const config = await this.actions.configure(options);
      const phase = await this.actions.select("Hooks", hookOptions(config), `hooks:${config.scope}`);
      if (!phase || phase === "back") return;
      const hook = phase as (typeof HOOK_PHASES)[number];
      const commands = config.effective.hooks[hook] ?? [];
      const edited = await listEditor(this.ctx, `Hooks · ${hook}`, commands, "command");
      if (edited && JSON.stringify(edited) !== JSON.stringify(commands))
        await this.actions.configure({ ...options, settings: { hooks: { [hook]: edited } } });
    }
  };

  private edit = async (
    config: Configuration,
    choice: string,
    options: ConfigureOptions,
  ): Promise<SettingsPatch | undefined> => {
    if (choice === "strategy") {
      const strategy = await this.actions.select(
        "Default strategy",
        STRATEGY_CHOICES,
        "strategy",
        undefined,
        config.effective.defaultStrategy === "local" ? "Local" : "Branch",
      );
      return strategy ? { settings: { defaultStrategy: strategy === "Local" ? "local" : "branch" } } : undefined;
    }
    if (choice === "branch") {
      const ref = await branchPicker(
        this.ctx,
        await this.service.branches(this.ctx.cwd, undefined, this.ctx.signal),
        config.effective.baseBranch,
        "Default base branch",
      );
      return ref ? { settings: { baseBranch: ref } } : undefined;
    }
    if (choice === "root" || choice === "executable") {
      const value = await textInput(
        this.ctx,
        choice === "root" ? "Storage root" : "Rift executable",
        config.settings[choice] ?? config.effective[choice],
      );
      return value?.trim() ? { settings: { [choice]: value } } : undefined;
    }
    if (choice === "exclude") {
      const edited = await listEditor(this.ctx, "Exclusions", config.effective.exclude, "pattern");
      return edited && JSON.stringify(edited) !== JSON.stringify(config.effective.exclude)
        ? { settings: { exclude: edited } }
        : undefined;
    }
    if (choice === "transferNotice") return { settings: { transferNotice: !config.effective.transferNotice } };
    if (choice === "hooks") {
      await this.hooks(options);
      return;
    }
    if (choice !== "reset") return;
    if (
      await this.ctx.ui.confirm(
        "Reset configuration overrides?",
        `Remove all overrides in ${config.path}. Inherited defaults will apply.`,
        { signal: this.ctx.signal },
      )
    )
      return { reset: true };
  };

  private apply = async (config: Configuration, choice: string, options: ConfigureOptions): Promise<void> => {
    const patch = await this.edit(config, choice, options);
    if (patch) await this.actions.configure({ ...options, ...patch });
  };

  private settings = async (options: ConfigureOptions): Promise<void> => {
    while (!this.ctx.signal?.aborted) {
      const config = await this.actions.configure(options);
      const choice = await this.actions.select(
        `Configuration · ${config.scope}\n${oneLine(config.path)}`,
        settingsOptions(config),
        `config:${config.scope}`,
      );
      if (!choice || choice === "back") return;
      const { error } = await tryCatch(this.apply(config, choice, options));
      if (error) this.actions.report(error);
    }
  };
}
