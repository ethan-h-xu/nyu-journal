import { useEffect, useRef, useState } from "react";
import type { AuthState } from "./useAuth";
import { profileOf } from "./useAuth";
import { GoogleButton } from "./GoogleButton";

interface AccountMenuProps {
  auth: AuthState;
  onSignIn: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

/** The nav bar's right side: a sign-in button, or the signed-in user's menu. */
export function AccountMenu({ auth, onSignIn, onSignOut, onDeleteAccount }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    <div className="account" ref={menuRef}>
      <button
        type="button"
        className="account-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${name}`}
        onClick={() => setOpen((o) => !o)}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span>{name.charAt(0).toUpperCase()}</span>
        )}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-who">
            <strong>{name}</strong>
            {email !== name && <span>{email}</span>}
          </div>
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
