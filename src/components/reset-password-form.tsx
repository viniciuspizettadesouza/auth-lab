"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH
} from "@/lib/credentials";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const flowId = searchParams.get("flow");
  const error = searchParams.get("error");
  const [password, setPassword] = useState("new correct horse battery staple");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(
    error || !token ? "This reset link is invalid or has expired." : null
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token || !flowId) return;
    setBusy(true);
    setMessage(null);
    const started = performance.now();
    const result = await authClient.resetPassword(
      { newPassword: password, token },
      { headers: { "x-auth-flow-id": flowId } }
    );
    await fetch(`/api/lab/flows/${flowId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operation: "reset-password",
        outcome: result.error ? "failure" : "success",
        statusCode: result.error?.status ?? (result.error ? 400 : 200),
        durationMs: Math.round(performance.now() - started)
      })
    });
    setBusy(false);
    if (result.error) {
      setMessage("The reset proof or replacement password was rejected.");
      return;
    }
    router.push(`/methods/password?flow=${flowId}`);
  }

  return (
    <div className="reset-card">
      <p className="eyebrow">Password recovery</p>
      <h1>Replace the shared secret.</h1>
      <p>
        The reset token stays in the request only. The recorder captures the
        transition, never the proof or password.
      </p>
      <form className="form-stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="new-password">NEW PASSWORD</label>
          <input
            autoComplete="new-password"
            disabled={!token}
            id="new-password"
            maxLength={MAX_PASSWORD_LENGTH}
            minLength={MIN_PASSWORD_LENGTH}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <span className="field-help">
            {MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_LENGTH} characters. Common or
            compromised values are rejected.
          </span>
        </div>
        <button className="button" disabled={busy || !token || !flowId} type="submit">
          {busy ? <LoaderCircle className="animate-spin" size={15} /> : null}
          Reset password and revoke sessions
        </button>
        {message ? <p className="form-message error">{message}</p> : null}
      </form>
    </div>
  );
}
