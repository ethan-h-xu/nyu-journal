import { useEffect, useId } from "react";
import type { ReactNode } from "react";

interface SidePanelProps {
  title: string;
  /** Small text under the title, like "Also: …". */
  aside?: ReactNode;
  /** Small caps line under the title, like "3 entries". */
  subtitle?: ReactNode;
  /** Shows a back button, e.g. to return to the previous profile. */
  onBack?: () => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The panel that floats over the map's left side: a building's journal, or a
 * nav view like the diary. Escape closes it.
 */
export function SidePanel({ title, aside, subtitle, onBack, onClose, children }: SidePanelProps) {
  const id = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside className="side-panel" aria-labelledby={`${id}-title`}>
      <header className="side-panel-header">
        {onBack && (
          <button type="button" className="side-panel-back" onClick={onBack} aria-label="Back">
            ‹
          </button>
        )}
        <div className="side-panel-titles">
          <h2 id={`${id}-title`}>{title}</h2>
          {aside && <p className="side-panel-aside">{aside}</p>}
          {subtitle && <p className="side-panel-subtitle">{subtitle}</p>}
        </div>
        <button type="button" className="side-panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      {children}
    </aside>
  );
}
