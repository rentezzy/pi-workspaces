import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { SelectList } from "@earendil-works/pi-tui";
import { HINTS, MENU_ROWS } from "./constants.ts";
import { dialogCompletion, dialogView } from "./dialog.ts";
import type { Header, MenuItem } from "./types.ts";
import { matchesShortcut, navigateList, selectTheme } from "./utils.ts";

export const menuPicker = async (
  ctx: ExtensionContext,
  title: string,
  options: (string | MenuItem)[],
  selected?: string,
  header?: Header,
): Promise<string | undefined> => {
  if (ctx.signal?.aborted) return;
  const items: MenuItem[] = options.map(item => (typeof item === "string" ? { value: item, label: item } : item));

  if (ctx.mode !== "tui") {
    const labels = items.map(item => item.label);
    const choice = await ctx.ui.select(title, labels, { signal: ctx.signal });
    return items[labels.indexOf(choice ?? "")]?.value;
  }

  return await ctx.ui.custom<string | undefined>((tui, theme, keys, done) => {
    const { finish, dispose } = dialogCompletion(ctx, done);
    const list = new SelectList(items, MENU_ROWS, selectTheme(theme));
    list.setSelectedIndex(
      Math.max(
        0,
        items.findIndex(item => item.value === selected),
      ),
    );
    list.onSelect = item => finish(item.value);
    list.onCancel = () => finish();

    const info = header?.(theme);
    const hints = items.filter(item => item.shortcut).map(item => `${item.shortcut} ${item.label.toLowerCase()}`);
    return dialogView(tui, theme, {
      dispose,
      layout: () => ({
        title,
        children: [...(info ? [info] : []), list],
        hint: [HINTS.navigate, HINTS.select, ...hints, HINTS.back].join(" · "),
      }),
      handleInput: data => {
        if (keys.matches(data, "tui.select.cancel")) return finish();
        const shortcut = items.find(item => item.shortcut && matchesShortcut(data, item.shortcut));
        if (shortcut) return finish(shortcut.value);
        if (!navigateList(data, list, items, keys)) list.handleInput(data);
      },
    });
  });
};
