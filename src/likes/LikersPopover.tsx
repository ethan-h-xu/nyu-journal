import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Profile } from "../profile/types";

type Likers = { status: "loading" } | { status: "ready"; users: Profile[] } | { status: "error" };

interface LikersPopoverProps {
  entryId: string;
  onOpenProfile: (userId: string) => void;
  onClose: () => void;
}

/**
 * Who liked one of your entries, newest first. Only an entry's author can
 * read this (row-level security); everyone else only gets counts.
 */
export function LikersPopover({ entryId, onOpenProfile, onClose }: LikersPopoverProps) {
  const [likers, setLikers] = useState<Likers>({ status: "loading" });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let current = true;
    void (async () => {
      const { data, error } = await supabase
        .from("entry_likes")
        .select("created_at, liker:profiles!entry_likes_user_id_fkey(id, username, bio)")
        .eq("entry_id", entryId)
        .order("created_at", { ascending: false });
      if (!current) return;
      setLikers(
        error ? { status: "error" } : { status: "ready", users: data.map((row) => row.liker) },
      );
    })();
    return () => {
      current = false;
    };
  }, [entryId]);

  // Close on a click outside, or Escape (without also closing the side panel).
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.parentElement?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="likers-popover" role="dialog" aria-label="Liked by" ref={ref}>
      <p className="likers-title">Liked by</p>
      {likers.status === "loading" ? (
        <p className="section-note">Loading…</p>
      ) : likers.status === "error" ? (
        <p className="section-note">Couldn't load who liked this.</p>
      ) : likers.users.length === 0 ? (
        <p className="section-note">No likes yet.</p>
      ) : (
        <ul>
          {likers.users.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className="user-link"
                onClick={() => {
                  onClose();
                  onOpenProfile(user.id);
                }}
              >
                @{user.username}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
