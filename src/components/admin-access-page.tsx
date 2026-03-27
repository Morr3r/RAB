"use client";

import { useState, useTransition, type FormEvent } from "react";

type LoginFieldErrors = {
  username?: string;
  password?: string;
};

type FeedbackType = "success" | "error" | "info";

type FeedbackMessage = {
  type: FeedbackType;
  text: string;
};

type AuthLoginApiResponse = {
  username?: string;
  fieldErrors?: LoginFieldErrors;
  error?: string;
};

type AdminAccessPageProps = {
  initialAdminUsername?: string | null;
};

const LOGIN_USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const LOGIN_USERNAME_MIN_LENGTH = 3;
const LOGIN_USERNAME_MAX_LENGTH = 32;
const LOGIN_PASSWORD_MIN_LENGTH = 8;
const AUTH_SESSION_CHANGED_EVENT = "engagement:auth-session-changed";

function validateLoginFields(usernameRaw: string, passwordRaw: string): LoginFieldErrors {
  const username = usernameRaw.trim();
  const password = passwordRaw.trim();
  const fieldErrors: LoginFieldErrors = {};

  if (!username) {
    fieldErrors.username = "Username wajib diisi.";
  } else if (
    username.length < LOGIN_USERNAME_MIN_LENGTH ||
    username.length > LOGIN_USERNAME_MAX_LENGTH
  ) {
    fieldErrors.username = `Username harus ${LOGIN_USERNAME_MIN_LENGTH}-${LOGIN_USERNAME_MAX_LENGTH} karakter.`;
  } else if (!LOGIN_USERNAME_PATTERN.test(username)) {
    fieldErrors.username = "Username hanya boleh huruf, angka, titik, garis bawah, atau strip.";
  }

  if (!password) {
    fieldErrors.password = "Password wajib diisi.";
  } else if (password.length < LOGIN_PASSWORD_MIN_LENGTH) {
    fieldErrors.password = `Password minimal ${LOGIN_PASSWORD_MIN_LENGTH} karakter.`;
  }

  return fieldErrors;
}

async function parseJsonResponse<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function resolveApiErrorMessage(
  payload: {
    error?: string;
  } | null,
  fallback: string
) {
  if (typeof payload?.error === "string" && payload.error.trim().length > 0) {
    return payload.error.trim();
  }

  return fallback;
}

function resolveRuntimeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return fallback;
}

export default function AdminAccessPage({ initialAdminUsername }: AdminAccessPageProps) {
  const [username, setUsername] = useState(initialAdminUsername?.trim() ?? "");
  const [password, setPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<LoginFieldErrors>({});
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  const login = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fieldErrors = validateLoginFields(username, password);

    if (Object.keys(fieldErrors).length > 0) {
      setLoginErrors(fieldErrors);
      setFeedback({ type: "error", text: "Mohon perbaiki form login terlebih dahulu." });
      return;
    }

    setLoginErrors({});
    setFeedback({ type: "info", text: "Memverifikasi akun admin..." });

    startTransition(() => {
      void (async () => {
        const normalizedUsername = username.trim();
        const normalizedPassword = password.trim();

        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username: normalizedUsername,
              password: normalizedPassword,
            }),
          });

          const payload = await parseJsonResponse<AuthLoginApiResponse>(response);
          if (!response.ok) {
            if (payload?.fieldErrors) {
              setLoginErrors(payload.fieldErrors);
            }
            throw new Error(resolveApiErrorMessage(payload, "Username atau password tidak valid."));
          }

          setPassword("");
          setFeedback({
            type: "success",
            text: "Login admin berhasil. Silakan kembali ke dashboard untuk edit data.",
          });
          window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
        } catch (error) {
          setFeedback({
            type: "error",
            text: resolveRuntimeErrorMessage(error, "Gagal login admin."),
          });
        }
      })();
    });
  };

  const isLoginDataValid = Object.keys(validateLoginFields(username, password)).length === 0;

  return (
    <div className="page-shell">
      <main className="content-wrap admin-login-wrap">
        <section className="admin-corner-card">
          <p className="admin-title">Akses Admin</p>
          <form className="admin-access-form" onSubmit={login}>
            <label className="field-label">
              Username
              <input
                className="input"
                autoComplete="username"
                value={username}
                minLength={LOGIN_USERNAME_MIN_LENGTH}
                maxLength={LOGIN_USERNAME_MAX_LENGTH}
                pattern="[A-Za-z0-9._-]+"
                title="Gunakan huruf, angka, titik, garis bawah, atau strip."
                aria-invalid={Boolean(loginErrors.username)}
                aria-describedby={loginErrors.username ? "admin-username-error" : undefined}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setLoginErrors((current) =>
                    current.username ? { ...current, username: undefined } : current
                  );
                }}
                required
              />
              {loginErrors.username && (
                <span className="field-error" id="admin-username-error">
                  {loginErrors.username}
                </span>
              )}
            </label>

            <label className="field-label">
              Password
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                minLength={LOGIN_PASSWORD_MIN_LENGTH}
                aria-invalid={Boolean(loginErrors.password)}
                aria-describedby={loginErrors.password ? "admin-password-error" : undefined}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setLoginErrors((current) =>
                    current.password ? { ...current, password: undefined } : current
                  );
                }}
                required
              />
              {loginErrors.password && (
                <span className="field-error" id="admin-password-error">
                  {loginErrors.password}
                </span>
              )}
            </label>

            <button className="button button-primary" disabled={isPending || !isLoginDataValid} type="submit">
              Login Admin
            </button>
          </form>
          {feedback && <p className={`feedback feedback-${feedback.type}`}>{feedback.text}</p>}
        </section>
      </main>
    </div>
  );
}
