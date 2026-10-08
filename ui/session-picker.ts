import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Input, matchesKey, Spacer, Text } from "@earendil-works/pi-tui";
import { DEFAULT_GROUPING } from "../sessions/constants.ts";
import { sessionRows, visibleSessions } from "../sessions/grouping.ts";
import type { WorkspaceSession } from "../sessions/types.ts";
import { BACK, SESSION_MAX_ROWS, SESSION_MIN_ROWS } from "./constants.ts";
import { dialogCompletion, dialogView } from "./dialog.ts";
import { SessionList } from "./session-list.ts";
import { sessionDetails, sessionLabel, sessionPickerHint, sessionPickerTitle } from "./session-view.ts";
import type { SessionChoice, SessionDialogState, SessionPickerState } from "./types.ts";
import { fillInput } from "./utils.ts";

export const sessionPicker = async (
  ctx: ExtensionContext,
  sessions: WorkspaceSession[],
  projectId: string | undefined,
  state: SessionPickerState,
): Promise<SessionChoice | undefined> => {
  state.grouping ??= DEFAULT_GROUPING;
  const currentId = ctx.sessionManager.getSessionId();

  if (ctx.mode !== "tui") {
    const rows = visibleSessions(sessions, projectId, state, currentId);
    const labels = rows.map(sessionLabel);
    const selected = await ctx.ui.select(`Resume · ${state.projectOnly ? "Project" : "All"}`, [...labels, BACK], {
      signal: ctx.signal,
    });
    const session = rows[labels.indexOf(selected ?? "")];
    return session ? { session, action: "resume" } : undefined;
  }

  return await ctx.ui.custom<SessionChoice | undefined>((tui, theme, keys, done) => {
    const { finish, dispose } = dialogCompletion(ctx, done);
    const input = new Input({
      prompt: "Search: ",
      placeholder: "conversation or workspace",
      placeholderStyle: text => theme.fg("dim", text),
    });
    fillInput(input, state.query);
    const dialog: SessionDialogState = {};
    const choose = (action: SessionChoice["action"]) => {
      const session = dialog.list!.selected();
      if (!session) return;
      state.selected = session.path;
      finish({ session, action });
    };
    const rebuild = () => {
      state.selected = dialog.list?.selected()?.path ?? state.selected;
      const rows = visibleSessions(sessions, projectId, state, currentId);
      dialog.list = new SessionList(
        sessionRows(sessions, rows, state.grouping, state.projectOnly, currentId),
        theme,
        currentId,
      );
      dialog.list.select(state.selected ?? rows.find(session => session.id === currentId)?.path);
      dialog.list.onSelect = () => choose("resume");
    };
    rebuild();
    const details = sessionDetails(() => dialog.list!.selected(), theme);

    return dialogView(tui, theme, {
      dispose,
      focus: input,
      layout: width => {
        const hint = sessionPickerHint(keys, projectId);
        const title = sessionPickerTitle(state);
        const above = [new Spacer(1), details, new Spacer(1), input, new Spacer(1)];
        const chrome =
          above.reduce((height, component) => height + component.render(width).length, 0) +
          new Text(title, 1, 0).render(width).length +
          new Text(hint, 1, 0).render(width).length +
          3;
        dialog.list!.maxRows = Math.max(SESSION_MIN_ROWS, Math.min(SESSION_MAX_ROWS, tui.terminal.rows - chrome - 3));
        return { title, children: [...above, dialog.list!, new Spacer(1)], hint };
      },
      handleInput: data => {
        if (keys.matches(data, "tui.select.cancel")) return finish();
        if (matchesKey(data, "shift+tab")) {
          state.history = !state.history;
          return rebuild();
        }
        if (projectId && matchesKey(data, "ctrl+p")) {
          state.projectOnly = !state.projectOnly;
          return rebuild();
        }
        if (keys.matches(data, "tui.input.tab")) {
          state.grouping = state.grouping === "workspace" ? "session" : "workspace";
          return rebuild();
        }
        if (keys.matches(data, "tui.select.confirm")) return choose("resume");
        if (keys.matches(data, "app.session.rename")) return choose("rename");
        if (keys.matches(data, "app.session.delete")) return choose("delete");
        if (dialog.list!.navigate(data, keys)) return;

        const before = input.getValue();
        input.handleInput(data);
        state.query = input.getValue();
        if (state.query !== before) rebuild();
      },
    });
  });
};
