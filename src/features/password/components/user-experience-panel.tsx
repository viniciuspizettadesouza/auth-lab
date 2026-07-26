import {
  Check,
  ExternalLink,
  LoaderCircle,
  LogOut,
  RefreshCw
} from "lucide-react";

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/features/password/server/credentials";
import type { MethodPanelDefinition } from "@/contracts";
import type { PasswordLabController } from "@/features/password/use-password-lab-controller";
import { PanelShell } from "@/features/password/components/panel-shell";

export function UserExperiencePanel({
  controller,
  definition
}: {
  controller: PasswordLabController;
  definition: MethodPanelDefinition;
}) {
  const {
    activeFlow,
    busy,
    email,
    handleSubmit,
    loadSessions,
    mailpitUrl,
    message,
    mode,
    name,
    password,
    revokeSession,
    session,
    sessionPending,
    sessions,
    setEmail,
    setMode,
    setName,
    setPassword,
    signOut
  } = controller;

  return (
    <PanelShell definition={definition} index={1}>
      {session?.user ? (
        <div className="form-stack">
          <p className="form-message success">
            <Check size={14} style={{ display: "inline", marginRight: 7 }} />
            Signed in as {session.user.email}
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void signOut()}
            type="button"
          >
            <LogOut size={15} /> Sign out
          </button>
          <button
            className="button secondary"
            onClick={() => void loadSessions(activeFlow?.id)}
            type="button"
          >
            <RefreshCw size={14} /> Inspect sessions
          </button>
          <div>
            {sessions.map((item) => (
              <div className="session-card" key={item.id}>
                <div className="session-top">
                  <span className="session-id">
                    {item.id.slice(0, 8)}… {item.current ? "· current" : ""}
                  </span>
                  <button
                    className="button danger small"
                    onClick={() => void revokeSession(item.id)}
                    type="button"
                  >
                    Revoke
                  </button>
                </div>
                <p>
                  Expires {new Date(item.expiresAt).toLocaleString()}
                  <br />
                  {item.userAgent?.slice(0, 80) ?? "Unknown user agent"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="auth-tabs" role="tablist" aria-label="Password journeys">
            {[
              ["sign-up", "Sign up"],
              ["sign-in", "Sign in"],
              ["forgot", "Reset"]
            ].map(([value, label]) => (
              <button
                aria-selected={mode === value}
                className={`auth-tab ${mode === value ? "active" : ""}`}
                key={value}
                onClick={() => setMode(value as typeof mode)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="defense-strip" aria-label="Active online guessing defenses">
            <div>
              <span>Defense active</span>
              <strong>
                {mode === "sign-in"
                  ? "10 sign-in requests / client / minute"
                  : mode === "forgot"
                    ? "5 reset requests / client / minute"
                    : "Common-password screening"}
              </strong>
            </div>
            <p>
              The local lab throttles requests and never provides an automated
              guessing tool.
            </p>
          </div>
          <form className="form-stack" onSubmit={handleSubmit}>
            {mode === "sign-up" ? (
              <div className="field">
                <label htmlFor="name">NAME</label>
                <input
                  autoComplete="name"
                  id="name"
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="email">EMAIL</label>
              <input
                autoComplete="email"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            {mode !== "forgot" ? (
              <div className="field">
                <label htmlFor="password">PASSWORD</label>
                <input
                  autoComplete={
                    mode === "sign-up" ? "new-password" : "current-password"
                  }
                  id="password"
                  maxLength={MAX_PASSWORD_LENGTH}
                  minLength={MIN_PASSWORD_LENGTH}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
                <span className="field-help">
                  {MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_LENGTH} characters; spaces,
                  Unicode, paste, and password managers are welcome. Common or
                  compromised values are blocked. The recorder stores only the
                  field name.
                </span>
              </div>
            ) : null}
            <button className="button" disabled={busy} type="submit">
              {busy ? <LoaderCircle className="animate-spin" size={15} /> : null}
              {mode === "sign-up"
                ? "Create account"
                : mode === "sign-in"
                  ? "Create session"
                  : "Send reset link"}
            </button>
            {message ? (
              <p className={`form-message ${message.tone}`}>{message.text}</p>
            ) : null}
            {mode === "sign-up" ||
            mode === "forgot" ||
            message?.text.includes("Mailpit") ? (
              <a
                className="mailpit-link"
                href={mailpitUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open local Mailpit inbox <ExternalLink size={14} />
              </a>
            ) : null}
          </form>
        </>
      )}
      {sessionPending ? (
        <p className="field-help" style={{ marginTop: 12 }}>
          Checking the database-backed session…
        </p>
      ) : null}
    </PanelShell>
  );
}
