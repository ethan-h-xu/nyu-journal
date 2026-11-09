import { useEffect, useRef, useState } from "react";
import type { AuthState } from "./useAuth";
import { profileOf } from "./useAuth";
import { GoogleButton } from "./GoogleButton";

/** How long the pointer can be away before a hover-opened menu closes. */
const HOVER_CLOSE_DELAY_MS = 250;

interface AccountMenuProps {
  auth: AuthState;
  /** The signed-in user's username, once their profile has loaded. */
  username: string | null;
  /** Friend requests waiting for an answer; shown as a badge. */
  requestCount: number;
  onOpenProfile: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

/** The nav bar's right side: a sign-in button, or the signed-in user's menu. */
export function AccountMenu({
  auth,
  username,
  requestCount,
  onOpenProfile,
  onSignIn,
  onSignOut,
  onDeleteAccount,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // True while the menu is open only because a mouse is over it, so leaving
  // closes it. Clicking the avatar makes it stay (false) until clicked away.
  const hoverOpenRef = useRef(false);
  const closeTimerRef = useRef<number | undefined>(undefined);

  const cancelHoverClose = () => window.clearTimeout(closeTimerRef.current);

  useEffect(() => {
    if (!open) {
      hoverOpenRef.current = false;
      cancelHoverClose();
    }
  }, [open]);
  useEffect(() => cancelHoverClose, []);

  // Close on any click outside the menu, or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (auth.status === "loading") return null;
  if (auth.status === "signedOut") return <GoogleButton onClick={onSignIn} className="nav-sign-in" />;

  const { name, email, avatarUrl } = profileOf(auth.user);
  return (
    <div
      className="account"
      ref={menuRef}
      // Mouse only: touch has no hover, and keyboard users click.
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return;
        cancelHoverClose();
        if (!open) {
          hoverOpenRef.current = true;
          setOpen(true);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse" || !hoverOpenRef.current) return;
        closeTimerRef.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
      }}
    >
      <button
        type="button"
        className="account-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          requestCount > 0
            ? `Account: ${name}, ${requestCount} friend ${requestCount === 1 ? "request" : "requests"}`
            : `Account: ${name}`
        }
        onClick={() => {
          // Already open from hovering: a click keeps it open rather than closing it.
          if (open && hoverOpenRef.current) {
            hoverOpenRef.current = false;
            return;
          }
          setOpen((o) => !o);
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span>{name.charAt(0).toUpperCase()}</span>
        )}
      </button>
      {requestCount > 0 && (
        // Outside the button, which clips to a circle; the label already says the count.
        <span className="account-badge" aria-hidden="true">
          {requestCount > 9 ? "9+" : requestCount}
        </span>
      )}
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-who">
            <strong>{name}</strong>
            {username && <span>@{username}</span>}
            {email !== name && <span>{email}</span>}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenProfile();
            }}
          >
            My profile
            {requestCount > 0 && <span className="menu-badge">{requestCount}</span>}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            Sign out
          </button>
          <a role="menuitem" href="/privacy.html">
            Privacy policy
          </a>
          <button
            type="button"
            role="menuitem"
            className="account-danger"
            onClick={() => {
              setOpen(false);
              onDeleteAccount();
            }}
          >
            Delete account
          </button>
        </div>
      )}
    </div>
  );
}
