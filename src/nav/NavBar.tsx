/** The views the nav bar opens. Add new ones (e.g. "feed") here and to NAV_ITEMS. */
export type NavView = "diary";

const NAV_ITEMS: { view: NavView; label: string }[] = [
  { view: "diary", label: "Diary" },
  // { view: "feed", label: "Friend feed" },
];

interface NavBarProps {
  active: NavView | null;
  /** Called with a view to open it, or with the active view to close it. */
  onToggle: (view: NavView) => void;
}

export function NavBar({ active, onToggle }: NavBarProps) {
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
      {/* Account controls, like Sign in, go on the right. */}
      <div className="nav-account" />
    </header>
  );
}
