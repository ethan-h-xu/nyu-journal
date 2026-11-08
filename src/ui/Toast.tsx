import { useEffect } from "react";

const TOAST_MS = 6000;

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

/** A short error message along the bottom that dismisses itself. */
export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="toast" role="alert">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
