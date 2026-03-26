"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type HomeLoadingGateProps = {
  children: ReactNode;
};

type FloatingHeart = {
  left: string;
  size: string;
  delay: string;
  duration: string;
};

type GateStage = "loading" | "ready" | "auth";

type LoginFieldErrors = {
  username?: string;
  password?: string;
};

type AuthLoginApiResponse = {
  username?: string;
  fieldErrors?: LoginFieldErrors;
  error?: string;
};

type FeedbackType = "success" | "error" | "info";

type FeedbackMessage = {
  type: FeedbackType;
  text: string;
};

const SPLASH_DURATION_MS = 3600;
const EXIT_ANIMATION_MS = 620;

const LOGIN_USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const LOGIN_USERNAME_MIN_LENGTH = 3;
const LOGIN_USERNAME_MAX_LENGTH = 32;
const LOGIN_PASSWORD_MIN_LENGTH = 8;
const LOGIN_PASSWORD_MAX_LENGTH = 128;

const FLOATING_HEARTS: FloatingHeart[] = [
  { left: "8%", size: "14px", delay: "-0.6s", duration: "7.2s" },
  { left: "16%", size: "10px", delay: "-1.8s", duration: "6.4s" },
  { left: "28%", size: "16px", delay: "-0.2s", duration: "8.1s" },
  { left: "39%", size: "11px", delay: "-2.4s", duration: "7s" },
  { left: "51%", size: "13px", delay: "-1s", duration: "6.8s" },
  { left: "63%", size: "15px", delay: "-2.8s", duration: "8.4s" },
  { left: "74%", size: "9px", delay: "-1.2s", duration: "6.2s" },
  { left: "84%", size: "13px", delay: "-0.4s", duration: "7.6s" },
  { left: "92%", size: "12px", delay: "-1.6s", duration: "6.7s" },
];

let hasPlayedInRuntime = false;
const GATE_RESET_EVENT = "engagement:gate-reset";

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
  } else if (
    password.length < LOGIN_PASSWORD_MIN_LENGTH ||
    password.length > LOGIN_PASSWORD_MAX_LENGTH
  ) {
    fieldErrors.password = `Password harus ${LOGIN_PASSWORD_MIN_LENGTH}-${LOGIN_PASSWORD_MAX_LENGTH} karakter.`;
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

export default function HomeLoadingGate({ children }: HomeLoadingGateProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(() => !hasPlayedInRuntime);
  const [isExiting, setIsExiting] = useState(false);
  const [stage, setStage] = useState<GateStage>("loading");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<LoginFieldErrors>({});
  const [loginFeedback, setLoginFeedback] = useState<FeedbackMessage | null>(null);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const loginUsernameInputRef = useRef<HTMLInputElement | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (hasPlayedInRuntime) {
      return;
    }

    const stageTimer = window.setTimeout(() => {
      // First visit: show "Klik untuk memulai" state after splash.
      setStage("ready");
    }, SPLASH_DURATION_MS);

    return () => {
      window.clearTimeout(stageTimer);
    };
  }, []);

  useEffect(() => {
    if (stage !== "auth") {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      loginUsernameInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [stage]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleGateReset = () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }

      hasPlayedInRuntime = false;
      setIsExiting(false);
      setIsVisible(true);
      setStage("ready");
      setLoginUsername("");
      setLoginPassword("");
      setIsPasswordVisible(false);
      setLoginErrors({});
      setLoginFeedback(null);
      setIsLoginSubmitting(false);
    };

    window.addEventListener(GATE_RESET_EVENT, handleGateReset);
    return () => window.removeEventListener(GATE_RESET_EVENT, handleGateReset);
  }, []);

  const cardStyle = useMemo(
    () =>
      ({
        "--romantic-loader-duration": `${SPLASH_DURATION_MS - 220}ms`,
      }) as CSSProperties,
    []
  );

  const isLoginDataValid =
    Object.keys(validateLoginFields(loginUsername, loginPassword)).length === 0;

  const finishGate = () => {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
    }

    setIsExiting(true);

    exitTimerRef.current = window.setTimeout(() => {
      hasPlayedInRuntime = true;
      setIsVisible(false);
      router.refresh();
    }, EXIT_ANIMATION_MS);
  };

  const handleViewMode = async () => {
    if (isLoginSubmitting) {
      return;
    }

    const fieldErrors = validateLoginFields(loginUsername, loginPassword);
    if (Object.keys(fieldErrors).length > 0) {
      setLoginErrors(fieldErrors);
      setLoginFeedback({ type: "error", text: "Mohon perbaiki form login terlebih dahulu." });
      return;
    }

    setLoginErrors({});
    setLoginFeedback({ type: "info", text: "Memverifikasi akun untuk View Mode..." });
    setIsLoginSubmitting(true);

    const normalizedUsername = loginUsername.trim();
    const normalizedPassword = loginPassword.trim();

    try {
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: normalizedUsername,
          password: normalizedPassword,
        }),
      });

      const verifyPayload = await parseJsonResponse<AuthLoginApiResponse>(verifyResponse);
      if (!verifyResponse.ok) {
        if (verifyPayload?.fieldErrors) {
          setLoginErrors(verifyPayload.fieldErrors);
        }
        throw new Error(resolveApiErrorMessage(verifyPayload, "Username atau password tidak valid."));
      }

      setLoginFeedback({ type: "success", text: "View Mode aktif. Memasuki dashboard..." });
      finishGate();
    } catch (error) {
      setLoginFeedback({
        type: "error",
        text: resolveRuntimeErrorMessage(error, "Gagal masuk ke View Mode."),
      });
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoginSubmitting) {
      return;
    }

    const fieldErrors = validateLoginFields(loginUsername, loginPassword);
    if (Object.keys(fieldErrors).length > 0) {
      setLoginErrors(fieldErrors);
      setLoginFeedback({ type: "error", text: "Mohon perbaiki form login terlebih dahulu." });
      return;
    }

    setLoginErrors({});
    setLoginFeedback({ type: "info", text: "Memverifikasi akun admin..." });
    setIsLoginSubmitting(true);

    const normalizedUsername = loginUsername.trim();
    const normalizedPassword = loginPassword.trim();

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

      setLoginFeedback({ type: "success", text: "Login berhasil. Memasuki dashboard..." });
      finishGate();
    } catch (error) {
      setLoginFeedback({
        type: "error",
        text: resolveRuntimeErrorMessage(error, "Gagal login admin."),
      });
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  return (
    <>
      {children}

      {isVisible && (
        <div className={`romantic-loader${isExiting ? " is-exiting" : ""}`} role="status" aria-live="polite">
          <div className="romantic-loader-aura romantic-loader-aura-left" aria-hidden />
          <div className="romantic-loader-aura romantic-loader-aura-right" aria-hidden />
          <div className="romantic-loader-vignette" aria-hidden />

          <div className="romantic-loader-hearts" aria-hidden>
            {FLOATING_HEARTS.map((heart, index) => (
              <span
                key={`${heart.left}-${index}`}
                className="romantic-loader-heart"
                style={
                  {
                    "--heart-left": heart.left,
                    "--heart-size": heart.size,
                    "--heart-delay": heart.delay,
                    "--heart-duration": heart.duration,
                  } as CSSProperties
                }
              />
            ))}
          </div>

          <section className="romantic-loader-card" style={cardStyle} aria-label="Loading Afghany and Zahro">
            <p className="romantic-loader-eyebrow">Monitoring Management Operation</p>
            <h1 className="romantic-loader-title">
              Afghany<span>&</span>Zahro
            </h1>

            {stage === "loading" && (
              <>
                <p className="romantic-loader-copy">Preparing your romantic journey and memories...</p>
                <div className="romantic-loader-rings" aria-hidden>
                  <span className="romantic-loader-ring romantic-loader-ring-left" />
                  <span className="romantic-loader-ring romantic-loader-ring-right" />
                </div>
                <div className="romantic-loader-progress" aria-hidden>
                  <span className="romantic-loader-progress-fill" />
                </div>
              </>
            )}

            {stage === "ready" && (
              <div className="romantic-loader-ready">
                <p className="romantic-loader-copy">
                  Cerita siap dimulai. Tekan tombol di bawah untuk lanjut ke dashboard.
                </p>
                <button
                  type="button"
                  className="button button-primary romantic-loader-start-button"
                  onClick={() => setStage("auth")}
                >
                  Klik untuk memulai
                </button>
              </div>
            )}

            {stage === "auth" && (
              <div className="romantic-loader-auth-shell">
                <p className="romantic-loader-auth-title">Login Dulu untuk Melanjutkan</p>
                <p className="romantic-loader-auth-copy">
                  Demi keamanan data, halaman hanya bisa diakses setelah login.
                </p>

                <form className="romantic-loader-auth-form" onSubmit={handleLogin}>
                  <label className="field-label romantic-loader-auth-field">
                    Username
                    <input
                      ref={loginUsernameInputRef}
                      className="input"
                      autoComplete="username"
                      value={loginUsername}
                      minLength={LOGIN_USERNAME_MIN_LENGTH}
                      maxLength={LOGIN_USERNAME_MAX_LENGTH}
                      pattern="[A-Za-z0-9._-]+"
                      title="Gunakan huruf, angka, titik, garis bawah, atau strip."
                      aria-invalid={Boolean(loginErrors.username)}
                      aria-describedby={loginErrors.username ? "home-loader-username-error" : undefined}
                      onChange={(event) => {
                        setLoginUsername(event.target.value);
                        setLoginErrors((current) =>
                          current.username ? { ...current, username: undefined } : current
                        );
                      }}
                      required
                    />
                    {loginErrors.username && (
                      <span className="field-error" id="home-loader-username-error">
                        {loginErrors.username}
                      </span>
                    )}
                  </label>

                  <label className="field-label romantic-loader-auth-field">
                    Password
                    <div className="romantic-loader-password-wrap">
                      <input
                        className="input"
                        type={isPasswordVisible ? "text" : "password"}
                        autoComplete="current-password"
                        value={loginPassword}
                        minLength={LOGIN_PASSWORD_MIN_LENGTH}
                        maxLength={LOGIN_PASSWORD_MAX_LENGTH}
                        aria-invalid={Boolean(loginErrors.password)}
                        aria-describedby={loginErrors.password ? "home-loader-password-error" : undefined}
                        onChange={(event) => {
                          setLoginPassword(event.target.value);
                          setLoginErrors((current) =>
                            current.password ? { ...current, password: undefined } : current
                          );
                        }}
                        required
                      />
                      <button
                        type="button"
                        className="romantic-loader-password-toggle"
                        onClick={() => setIsPasswordVisible((current) => !current)}
                        aria-label={isPasswordVisible ? "Sembunyikan password" : "Tampilkan password"}
                        title={isPasswordVisible ? "Sembunyikan password" : "Tampilkan password"}
                      >
                        {isPasswordVisible ? "Hide" : "Show"}
                      </button>
                    </div>
                    {loginErrors.password && (
                      <span className="field-error" id="home-loader-password-error">
                        {loginErrors.password}
                      </span>
                    )}
                  </label>

                  <div className="romantic-loader-auth-actions">
                    <button
                      className="button button-secondary romantic-loader-view-button"
                      disabled={isLoginSubmitting || !isLoginDataValid}
                      type="button"
                      onClick={() => {
                        void handleViewMode();
                      }}
                    >
                      {isLoginSubmitting ? "Memproses..." : "View Mode"}
                    </button>

                    <button
                      className="button button-primary romantic-loader-auth-submit"
                      disabled={isLoginSubmitting || !isLoginDataValid}
                      type="submit"
                    >
                      {isLoginSubmitting ? "Memproses..." : "Login"}
                    </button>
                  </div>
                </form>

                {loginFeedback && (
                  <p className={`feedback feedback-${loginFeedback.type} romantic-loader-auth-feedback`}>
                    {loginFeedback.text}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
