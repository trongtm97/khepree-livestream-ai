import { useEffect, useId, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { useAppShell } from "../../app/AppShellContext";
import { getMicroTip, pickLocale } from "../../help";

export function MicroHelp({ tipId }: { tipId: string }) {
  const { locale, t } = useAppShell();
  const tip = getMicroTip(tipId);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!tip) return null;

  return (
    <span className="microHelp" ref={rootRef}>
      <button
        type="button"
        className="microHelpButton"
        aria-label={t("help.microAria")}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <CircleHelp size={15} />
      </button>
      {open ? (
        <div className="microHelpPopover" id={panelId} role="dialog">
          <strong>{pickLocale(tip.title, locale)}</strong>
          <p>{pickLocale(tip.body, locale)}</p>
        </div>
      ) : null}
    </span>
  );
}
