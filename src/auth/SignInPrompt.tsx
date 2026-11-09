import { GoogleButton } from "./GoogleButton";

/** Shown in place of the journal when nobody is signed in. */
export function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="side-panel-body panel-message">
      <p>Sign in to keep a diary of the NYU buildings you visit and share it with friends.</p>
      <GoogleButton onClick={onSignIn} />
      <p className="panel-message-fine">
        Only you and friends you accept can see your entries. <a href="/privacy.html">Privacy policy</a>
      </p>
    </div>
  );
}
