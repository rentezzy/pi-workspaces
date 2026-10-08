import type { KeybindingsManager, Theme } from "@earendil-works/pi-coding-agent";
import { SelectList, truncateToWidth, visibleWidth, type SelectItem, type TuiMouseEvent } from "@earendil-works/pi-tui";
import { sessionTitle } from "../sessions/grouping.ts";
import type { SessionRow, WorkspaceSession } from "../sessions/types.ts";
import { SESSION_EMPTY, SESSION_ROWS } from "./constants.ts";
import { navigateList, oneLine, selectTheme } from "./utils.ts";

export class SessionList {
  maxRows = SESSION_ROWS;
  onSelect?: (session: WorkspaceSession) => void;
  private items: SelectItem[];
  private selection: SelectList;
  private visible: SessionRow[] = [];
  private pressed?: string;

  constructor(
    private rows: SessionRow[],
    private theme: Theme,
    private currentId: string,
  ) {
    this.items = rows.flatMap(row =>
      row.session ? [{ value: row.session.path, label: sessionTitle(row.session) }] : [],
    );
    this.selection = new SelectList(this.items, SESSION_ROWS, selectTheme(theme));
  }

  selected = (): WorkspaceSession | undefined => {
    const path = this.selection.getSelectedItem()?.value;
    return this.rows.find(row => row.session?.path === path)?.session;
  };

  select = (path?: string): void =>
    this.selection.setSelectedIndex(
      Math.max(
        0,
        this.items.findIndex(item => item.value === path),
      ),
    );

  navigate = (data: string, keys: KeybindingsManager): boolean => navigateList(data, this.selection, this.items, keys);

  private sessionLine = (row: SessionRow, width: number): string => {
    const session = row.session!;
    const selected = session.path === this.selected()?.path;
    const cursor = selected ? this.theme.fg("accent", "› ") : "  ";
    const prefix = this.theme.fg("dim", row.prefix);
    const truncated = truncateToWidth(oneLine(row.label), Math.max(0, width - 2 - visibleWidth(row.prefix)), "…");
    const current = session.id === this.currentId ? this.theme.fg("success", truncated) : truncated;
    const label = selected ? this.theme.bold(current) : current;
    const line = truncateToWidth(cursor + prefix + label, width, "");
    return selected ? this.theme.bg("selectedBg", line + " ".repeat(Math.max(0, width - visibleWidth(line)))) : line;
  };

  private heading = (start: number): SessionRow | undefined => {
    if (!this.rows[start]?.session) return;
    return this.rows.slice(0, start).findLast(row => !row.session && !!row.label);
  };

  render = (width: number): string[] => {
    this.visible = [];
    if (!this.items.length) return [this.theme.fg("dim", truncateToWidth("  " + SESSION_EMPTY, width, "…"))];

    const selected = this.rows.findIndex(row => row.session?.path === this.selected()?.path);
    const capacity = Math.max(3, this.maxRows - (this.rows.length > this.maxRows ? 1 : 0));
    const initial = Math.max(0, Math.min(selected - Math.floor(capacity / 2), this.rows.length - capacity));
    const start = initial + (this.heading(initial) && selected >= initial + capacity - 1 ? 1 : 0);
    const sticky = this.heading(start);
    this.visible = [...(sticky ? [sticky] : []), ...this.rows.slice(start, start + capacity - (sticky ? 1 : 0))];
    const lines = this.visible.map(row =>
      row.session
        ? this.sessionLine(row, width)
        : this.theme.fg(
            row.current ? "success" : "accent",
            this.theme.bold(truncateToWidth("  " + oneLine(row.label), width, "…")),
          ),
    );

    if (this.rows.length > this.maxRows) {
      const more = [
        start > 0 ? "↑ more above" : "",
        start + capacity - (sticky ? 1 : 0) < this.rows.length ? "↓ more below" : "",
      ]
        .filter(Boolean)
        .join(" · ");
      lines.push(this.theme.fg("dim", truncateToWidth("  " + more, width, "")));
    }
    return [...lines, ...Array<string>(Math.max(0, Math.min(this.maxRows, this.rows.length) - lines.length)).fill("")];
  };

  handleMouse = (event: TuiMouseEvent) => {
    if (event.type === "wheel" && event.wheelDelta) {
      const index = this.items.findIndex(item => item.value === this.selected()?.path);
      this.selection.setSelectedIndex(index + (event.wheelDelta < 0 ? -1 : 1));
      return { handled: true, render: true };
    }
    if (event.button !== "left" || (event.type !== "press" && event.type !== "click")) return;

    const hovered = this.visible[event.y]?.session?.path;
    if (event.type === "press") this.pressed = hovered;
    const path = event.type === "click" ? (this.pressed ?? hovered) : hovered;
    if (!path) {
      this.pressed = undefined;
      return;
    }
    this.select(path);
    if (event.type === "click") {
      this.pressed = undefined;
      const selected = this.selected();
      if (selected) this.onSelect?.(selected);
    }
    return { handled: true, focus: true, render: true };
  };

  invalidate = () => {};
}
