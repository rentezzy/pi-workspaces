import { DynamicBorder, type ExtensionContext, type Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text, type Component, type TUI } from "@earendil-works/pi-tui";
import type { DialogOptions, DialogView } from "./types.ts";

export const dialogCompletion = <T>(ctx: ExtensionContext, done: (value: T | undefined) => void) => {
  const signal = ctx.signal;
  const state = { finished: false };
  const dispose = () => signal?.removeEventListener("abort", abort);
  const finish = (value?: T) => {
    if (state.finished) return;
    state.finished = true;
    dispose();
    done(value);
  };
  const abort = () => finish();

  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  return { finish, dispose };
};

export const frame = (theme: Theme, title: string, children: Component[], hint: string): Container => {
  const container = new Container();
  container.addChild(new DynamicBorder(text => theme.fg("accent", text)));
  container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));
  children.forEach(child => container.addChild(child));
  container.addChild(new Text(theme.fg("dim", hint), 1, 0));
  container.addChild(new DynamicBorder(text => theme.fg("accent", text)));
  return container;
};

export const dialogView = (tui: TUI, theme: Theme, options: DialogOptions): DialogView => {
  const state = { container: new Container() };
  const invalidate = () => state.container.invalidate();
  const redraw = () => {
    invalidate();
    tui.requestRender();
  };

  return {
    get focused() {
      return options.focus?.focused ?? false;
    },
    set focused(value: boolean) {
      if (options.focus) options.focus.focused = value;
    },
    render: width => {
      const { title, children, hint } = options.layout(width);
      state.container = frame(theme, title, children, hint);
      return state.container.render(width);
    },
    handleInput: data => {
      options.handleInput(data);
      redraw();
    },
    handleMouse: event => {
      options.beforeMouse?.(event);
      const result = state.container.handleMouse(event);
      redraw();
      return result;
    },
    invalidate,
    redraw,
    dispose: options.dispose,
  };
};
