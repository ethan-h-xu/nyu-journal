import type { ReactNode } from "react";

/** The views the nav bar opens. Add new ones here and to NAV_ITEMS. */
export type NavView = "diary" | "feed";

const NAV_ITEMS: { view: NavView; label: string }[] = [
  { view: "diary", label: "Diary" },
  { view: "feed", label: "Feed" },
];

interface NavBarProps {
  active: NavView | null;
  /** Called with a view to open it, or with the active view to close it. */
  onToggle: (view: NavView) => void;
  /** Account controls on the right: Sign in, or the signed-in user's menu. */
  account: ReactNode;
}

export function NavBar({ active, onToggle, account }: NavBarProps) {
  return (
    <header className="nav-bar">
      <span className="nav-brand">sh-tboxd</span>
      <nav className="nav-items" aria-label="Main">
        {NAV_ITEMS.map(({ view, label }) => (
          <button
            key={view}
            type="button"
            className="nav-item"
            aria-pressed={active === view}
            onClick={() => onToggle(view)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="nav-account">{account}</div>
    </header>
  );
}
