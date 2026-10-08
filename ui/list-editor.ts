import type { ExtensionContext, KeybindingsManager, Theme } from "@earendil-works/pi-coding-agent";
import { Input, SelectList, Text, type SelectItem, type TUI } from "@earendil-works/pi-tui";
import {
  BACK,
  LIST_ACTIONS,
  LIST_CHOICES,
  LIST_EDITOR_ROWS,
  LIST_INPUT_HINT,
  LIST_SELECTION_HINT,
} from "./constants.ts";
import { dialogCompletion, dialogView } from "./dialog.ts";
import { menuPicker } from "./menu.ts";
import type { DialogView, ListNoun } from "./types.ts";
import { fillInput, navigateList, oneLine, selectTheme } from "./utils.ts";

const editList = async (ctx: ExtensionContext, title: string, initial: string[], noun: ListNoun): Promise<string[]> => {
  const values = [...initial];
  for (;;) {
    const items = values.map((value, index) => ({ value: String(index), label: oneLine(value) }));
    const choice = await menuPicker(ctx, title, [...items, ...LIST_CHOICES]);
    if (!choice || choice === BACK) return values;
    if (choice === "Add") {
      const value = await ctx.ui.input(`New ${noun}`, undefined, { signal: ctx.signal });
      if (value?.trim()) values.push(value);
      continue;
    }

    const index = Number(choice);
    const action = await menuPicker(ctx, oneLine(values[index]!), LIST_ACTIONS);
    if (action === "Delete") values.splice(index, 1);
    if (action !== "Edit") continue;
    const value = await ctx.ui.input(`Edit ${noun}`, values[index], { signal: ctx.signal });
    if (value?.trim()) values[index] = value;
  }
};

class ListEditor {
  private values: string[];
  private input: Input;
  private inputFocus: boolean;
  private focusedState = false;
  private editing?: number;
  private items: SelectItem[] = [];
  private list!: SelectList;
  private inputRow = 0;

  constructor(
    private tui: TUI,
    private theme: Theme,
    private keys: KeybindingsManager,
    private title: string,
    initial: string[],
    private noun: ListNoun,
    private finish: (values?: string[]) => void,
  ) {
    this.values = [...initial];
    this.inputFocus = this.values.length === 0;
    this.input = new Input({
      prompt: "> ",
      placeholder: `New ${noun}…`,
      placeholderStyle: text => theme.fg("dim", text),
    });
    this.input.onSubmit = this.submit;
    this.rebuild();
  }

  get focused() {
    return this.focusedState;
  }
  set focused(value: boolean) {
    this.focusedState = value;
    this.input.focused = value && this.inputFocus;
  }

  view = (dispose: () => void): DialogView =>
    dialogView(this.tui, this.theme, {
      dispose,
      focus: this,
      layout: width => {
        const label = new Text(
          this.theme.fg(
            "muted",
            this.editing === undefined ? `Add ${this.noun}` : `Edit ${this.noun} ${this.editing + 1}`,
          ),
          1,
          0,
        );
        this.inputRow =
          1 +
          new Text(this.title, 1, 0).render(width).length +
          this.list.render(width).length +
          label.render(width).length;
        return {
          title: this.title,
          children: [this.list, label, this.input],
          hint: this.inputFocus ? LIST_INPUT_HINT : LIST_SELECTION_HINT,
        };
      },
      handleInput: this.handleInput,
      beforeMouse: event => {
        if ((event.type === "press" || event.type === "click") && event.y === this.inputRow) this.focusInput(true);
      },
    });

  private focusInput = (value: boolean): void => {
    this.inputFocus = value;
    this.input.focused = this.focusedState && value;
  };

  private rebuild = (index = 0): void => {
    this.items = this.values.map((value, index) => ({ value: String(index), label: oneLine(value) }));
    this.list = new SelectList(this.items, LIST_EDITOR_ROWS, {
      ...selectTheme(this.theme),
      noMatch: () => this.theme.fg("dim", `  No ${this.noun}s yet`),
    });
    this.list.setSelectedIndex(index);
    this.list.onSelect = this.selectList;
    this.list.onSelectionChange = this.selectList;
  };

  private selectList = (): void => {
    this.focusInput(false);
    this.tui.requestRender();
  };

  private edit = (index: number): void => {
    this.editing = index;
    fillInput(this.input, this.values[index]!);
    this.focusInput(true);
    this.tui.requestRender();
  };

  private submit = (): void => {
    const value = this.input.getValue();
    if (!value.trim()) return;
    const index = this.editing ?? this.values.length;
    if (this.editing === undefined) this.values.push(value);
    else this.values[this.editing] = value;
    this.editing = undefined;
    this.input.setValue("");
    this.rebuild(index);
    this.focusInput(false);
  };

  private move = (data: string): void => {
    const index = Number(this.list.getSelectedItem()?.value ?? 0);
    if (this.inputFocus && this.values.length && this.keys.matches(data, "tui.select.up")) {
      this.list.setSelectedIndex(this.editing ?? this.values.length - 1);
      return this.focusInput(false);
    }
    if (!this.inputFocus && this.keys.matches(data, "tui.select.down") && index === this.values.length - 1)
      return this.focusInput(true);
    if (!this.inputFocus) navigateList(data, this.list, this.items, this.keys);
  };

  private remove = (): void => {
    const index = Number(this.list.getSelectedItem()?.value);
    if (!Number.isInteger(index)) return;
    this.values.splice(index, 1);
    if (this.editing === index) {
      this.editing = undefined;
      this.input.setValue("");
    } else if (this.editing !== undefined && this.editing > index) this.editing--;
    this.rebuild(index);
    if (!this.values.length) this.focusInput(true);
  };

  private handleInput = (data: string): void => {
    if (this.keys.matches(data, "tui.select.cancel")) {
      if (this.editing === undefined) return this.finish(this.values);
      this.editing = undefined;
      this.input.setValue("");
      return this.focusInput(false);
    }
    if (this.keys.matches(data, "tui.input.tab")) return this.focusInput(!this.inputFocus || !this.values.length);
    if (this.keys.matches(data, "tui.select.up") || this.keys.matches(data, "tui.select.down")) return this.move(data);
    if (
      !this.inputFocus &&
      (this.keys.matches(data, "tui.editor.deleteCharForward") ||
        this.keys.matches(data, "tui.editor.deleteCharBackward"))
    )
      return this.remove();
    if (!this.inputFocus && this.keys.matches(data, "tui.select.confirm")) {
      const selected = this.list.getSelectedItem();
      if (selected) this.edit(Number(selected.value));
      return;
    }
    if (!this.inputFocus && navigateList(data, this.list, this.items, this.keys)) return;
    this.focusInput(true);
    this.input.handleInput(data);
  };
}

export const listEditor = async (
  ctx: ExtensionContext,
  title: string,
  initial: string[],
  noun: ListNoun,
): Promise<string[] | undefined> => {
  if (ctx.signal?.aborted) return;
  if (ctx.mode !== "tui") return await editList(ctx, title, initial, noun);

  return await ctx.ui.custom<string[] | undefined>((tui, theme, keys, done) => {
    const { finish, dispose } = dialogCompletion(ctx, done);
    return new ListEditor(tui, theme, keys, title, initial, noun, finish).view(dispose);
  });
};
