import { useEffect } from "react";

export const btn =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm text-foreground hover:bg-muted disabled:opacity-60 sm:h-8";
export const closeBtn =
  "grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted";
export const primaryBtn =
  "min-h-10 rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60";
// Side panel: full width on phones, floats over the book on tablets, sits beside it on desktop.
export const panelCls =
  "absolute inset-y-0 right-0 z-20 flex w-full flex-col gap-3 overflow-y-auto border-l border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-card-foreground sm:w-[420px] sm:shadow-xl lg:static lg:z-auto lg:w-[380px] lg:shrink-0 lg:shadow-none xl:w-[440px]";

// Esc closes dialogs/panels on keyboards.
export function useEscape(onEsc: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onEsc();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onEsc]);
}
