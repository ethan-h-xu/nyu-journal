import type { ReactNode } from "react";

/** The views the nav bar opens. Add new ones here and to NAV_ITEMS. */
export type NavView = "diary" | "feed" | "profile";

const NAV_ITEMS: { view: NavView; label: string }[] = [
  { view: "profile", label: "Profile" },
  { view: "diary", label: "Diary" },
  { view: "feed", label: "Feed" },
];

interface NavBarProps {
  active: NavView | null;
  /** Called with a view to open it, or with the active view to close it. */
  onToggle: (view: NavView) => void;
  /**
   * Views with something waiting, shown as a red dot. The text is read out with
   * the button's label, like "2 friend requests".
   */
  alerts?: Partial<Record<NavView, string>>;
  /** Account controls on the right: Sign in, or the signed-in user's menu. */
  account: ReactNode;
}

export function NavBar({ active, onToggle, alerts, account }: NavBarProps) {
  return (
    <header className="nav-bar">
      <span className="nav-brand">sh-tboxd</span>
      <nav className="nav-items" aria-label="Main">
        {NAV_ITEMS.map(({ view, label }) => {
          const alert = alerts?.[view];
          return (
            <button
              key={view}
              type="button"
              className="nav-item"
              aria-pressed={active === view}
              aria-label={alert ? `${label}, ${alert}` : undefined}
              onClick={() => onToggle(view)}
            >
              {label}
              {alert && <span className="nav-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </nav>
      <div className="nav-account">{account}</div>
    </header>
  );
}
