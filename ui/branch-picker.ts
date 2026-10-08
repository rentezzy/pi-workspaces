import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Input, SelectList, type SelectItem } from "@earendil-works/pi-tui";
import { BACK, BRANCH_EMPTY, BRANCH_HINT, BRANCH_ROWS, OTHER_REF } from "./constants.ts";
import { dialogCompletion, dialogView } from "./dialog.ts";
import type { BranchPickerState } from "./types.ts";
import { fillInput, navigateList, selectTheme } from "./utils.ts";

export const branchItems = (choices: string[], fallback: string, query: string): SelectItem[] =>
  choices
    .filter(branch => branch.toLowerCase().includes(query))
    .map(branch => ({ value: branch, label: branch, description: branch === fallback ? "default" : undefined }));

export const branchPicker = async (
  ctx: ExtensionContext,
  branches: string[],
  fallback: string,
  title = "Starting branch",
): Promise<string | undefined> => {
  if (ctx.signal?.aborted) return;
  const choices = [...new Set([fallback, ...branches])];

  if (ctx.mode !== "tui") {
    const choice = await ctx.ui.select(title, [...choices, OTHER_REF, BACK], { signal: ctx.signal });
    if (!choice || choice === BACK) return;
    return choice === OTHER_REF ? await ctx.ui.input(title, fallback, { signal: ctx.signal }) : choice;
  }

  return await ctx.ui.custom<string | undefined>((tui, theme, keys, done) => {
    const { finish, dispose } = dialogCompletion(ctx, done);
    const input = new Input({
      prompt: "Branch: ",
      placeholder: "type to filter; tab completes",
      placeholderStyle: text => theme.fg("dim", text),
    });
    const state: BranchPickerState = { items: [] };
    const rebuild = () => {
      const previous = state.list?.getSelectedItem()?.value;
      const query = input.getValue().trim().toLowerCase();
      state.items = branchItems(choices, fallback, query);
      const exact = state.items.findIndex(item => item.value.toLowerCase() === query);
      state.list = new SelectList(state.items, BRANCH_ROWS, {
        ...selectTheme(theme),
        noMatch: () => theme.fg("dim", BRANCH_EMPTY),
      });
      state.list.setSelectedIndex(
        Math.max(0, exact >= 0 ? exact : state.items.findIndex(item => item.value === previous)),
      );
      state.list.onSelect = item => finish(item.value);
      state.list.onCancel = () => finish();
    };
    rebuild();

    return dialogView(tui, theme, {
      dispose,
      focus: input,
      layout: () => ({ title, children: [input, state.list!], hint: BRANCH_HINT }),
      handleInput: data => {
        if (keys.matches(data, "tui.select.cancel")) return finish();
        if (keys.matches(data, "tui.select.confirm"))
          return finish(state.list!.getSelectedItem()?.value ?? (input.getValue().trim() || fallback));
        if (navigateList(data, state.list!, state.items, keys)) return;
        if (keys.matches(data, "tui.input.tab")) {
          const selected = state.list!.getSelectedItem();
          if (!selected) return;
          fillInput(input, selected.value);
          rebuild();
          return;
        }

        const before = input.getValue();
        input.handleInput(data);
        if (input.getValue() !== before) rebuild();
      },
    });
  });
};
