import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);

// Without Supabase settings the app can't run at all; say so instead of a blank page.
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  root.render(
    <main className="config-error">
      <h1>Missing configuration</h1>
      <p>
        Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (in{" "}
        <code>.env.local</code>, or in the Vercel project's environment variables), then rebuild.
      </p>
    </main>,
  );
} else {
  void import("./App").then(({ App }) =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );
}
