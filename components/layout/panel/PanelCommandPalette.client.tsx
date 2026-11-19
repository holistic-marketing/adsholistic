"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { flattenNavigation } from "@/config/navigation";
import { PanelDialog } from "@/components/ui/PanelDialog.client";
import { PanelIcon, type PanelIconName } from "@/components/ui/PanelIcon";
import { usePanel } from "./panel-context.client";
import { normalizeSearch, useQuickActions } from "./use-quick-actions.client";

interface Command {
  id: string;
  group: string;
  icon: PanelIconName;
  label: string;
  hint?: string;
  run: () => void;
}

/** Buscador de secciones y acciones (Ctrl K / ⌘ K). */
export function PanelCommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ts = useTranslations("nav.shell");
  return (
    <PanelDialog open={open} onClose={onClose} title={ts("paletteTitle")} size="command" closeLabel={ts("close")}>
      {open ? <PaletteBody onDone={onClose} /> : null}
    </PanelDialog>
  );
}

function PaletteBody({ onDone }: { onDone: () => void }) {
  const t = useTranslations("nav");
  const ts = useTranslations("nav.shell");
  const panel = usePanel();
  const quick = useQuickActions();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = flattenNavigation(panel.navigation).map((entry) => ({
      id: `go:${entry.href}`,
      group: ts("paletteGo"),
      icon: entry.icon,
      label: t(entry.labelKey ?? entry.key),
      hint: entry.parent && panel.persona !== "cliente" ? t(entry.parent.labelKey ?? entry.parent.key) : undefined,
      run: () => panel.go(entry.href),
    }));
    for (const group of quick) {
      for (const action of group.actions) {
        list.push({ id: `do:${action.id}`, group: ts("paletteActions"), icon: action.icon, label: action.title, hint: group.label, run: action.run });
      }
    }
    if (panel.isStaff) {
      if (!panel.actingAsCliente) {
        list.push({
          id: "client:pick",
          group: ts("paletteActions"),
          icon: "user",
          label: panel.selectedCliente ? ts("actionChangeClient") : ts("actionPickClient"),
          run: () => panel.openClientPicker(false),
        });
        if (panel.selectedCliente) {
          list.push({ id: "client:clear", group: ts("paletteActions"), icon: "users", label: ts("actionAllClients"), hint: ts("actionAllClientsHint"), run: panel.clearCliente });
        }
      }
      list.push({
        id: "view:toggle",
        group: ts("paletteActions"),
        icon: panel.actingAsCliente ? "building" : "user",
        label: panel.actingAsCliente ? ts("actionToAdmin") : ts("actionToClient"),
        run: () => panel.setActAsCliente(!panel.actingAsCliente),
      });
    }
    const dark = panel.theme === "dark";
    list.push(
      { id: "theme", group: ts("paletteActions"), icon: dark ? "sun" : "moon", label: dark ? ts("themeLight") : ts("themeDark"), run: panel.toggleTheme },
      { id: "contrast", group: ts("paletteActions"), icon: "contrast", label: panel.contrast === "alto" ? ts("contrastOff") : ts("contrastOn"), run: panel.toggleContrast },
    );
    return list;
  }, [panel, quick, t, ts]);

  const q = normalizeSearch(query);
  const results = q ? commands.filter((c) => normalizeSearch(`${c.label} ${c.hint ?? ""}`).includes(q)) : commands;
  const current = Math.min(index, Math.max(results.length - 1, 0));

  function run(command: Command | undefined) {
    if (!command) return;
    onDone();
    command.run();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = (current + step + results.length) % Math.max(results.length, 1);
      setIndex(next);
      document.getElementById(`cmd-${next}`)?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(results[current]);
    }
  }

  return (
    <>
      <div className="flex h-12 items-center gap-2.5 border-b border-line px-3.5 text-ink-3">
        <PanelIcon name="search" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls="cmd-list"
          aria-activedescendant={results.length ? `cmd-${current}` : undefined}
          aria-label={ts("paletteTitle")}
          placeholder={ts("palettePlaceholder")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
        <kbd>Esc</kbd>
      </div>
      <div id="cmd-list" role="listbox" aria-label={ts("paletteTitle")} className="max-h-[min(52vh,420px)] overflow-y-auto p-1.5">
        {results.length === 0 ? <p className="px-2 py-6 text-center text-ink-3">{ts("paletteNone")}</p> : null}
        {results.map((command, i) => {
          const header = i === 0 || results[i - 1].group !== command.group ? command.group : null;
          return (
            <div key={command.id}>
              {header ? (
                <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">{header}</p>
              ) : null}
              <div
                id={`cmd-${i}`}
                role="option"
                aria-selected={i === current}
                onMouseMove={() => setIndex(i)}
                onClick={() => run(command)}
                className={cn("flex h-9 cursor-pointer items-center gap-2.5 rounded-ctl px-2", i === current && "bg-hover")}
              >
                <PanelIcon name={command.icon} className="text-ink-2" />
                <span className="min-w-0 flex-1 truncate">{command.label}</span>
                {command.hint ? <small className="text-xs text-ink-3">{command.hint}</small> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3.5 border-t border-line px-3.5 py-2 text-[11px] text-ink-3">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> {ts("paletteMove")}
        </span>
        <span>
          <kbd>Enter</kbd> {ts("enterToPick")}
        </span>
        <span>
          <kbd>Esc</kbd> {ts("escToClose")}
        </span>
      </div>
    </>
  );
}
