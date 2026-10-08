import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Input } from "@earendil-works/pi-tui";
import { INPUT_HINT } from "./constants.ts";
import { dialogCompletion, dialogView } from "./dialog.ts";
import { fillInput } from "./utils.ts";

export const textInput = async (ctx: ExtensionContext, title: string, initial: string): Promise<string | undefined> => {
  if (ctx.signal?.aborted) return;
  if (ctx.mode !== "tui") return await ctx.ui.input(title, initial, { signal: ctx.signal });

  return await ctx.ui.custom<string | undefined>((tui, theme, keys, done) => {
    const { finish, dispose } = dialogCompletion(ctx, done);
    const input = new Input({ prompt: "> " });
    fillInput(input, initial);
    input.onSubmit = finish;

    return dialogView(tui, theme, {
      dispose,
      focus: input,
      layout: () => ({ title, children: [input], hint: INPUT_HINT }),
      handleInput: data => {
        if (keys.matches(data, "tui.select.cancel")) return finish();
        input.handleInput(data);
      },
    });
  });
};
