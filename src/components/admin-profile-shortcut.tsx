"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type AuthSessionApiResponse = {
  isAdmin?: boolean;
  isViewOnly?: boolean;
  isAuthenticated?: boolean;
  username?: string | null;
};

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

const LOGIN_USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const LOGIN_USERNAME_MIN_LENGTH = 3;
const LOGIN_USERNAME_MAX_LENGTH = 32;
const LOGIN_PASSWORD_MIN_LENGTH = 8;
const LOGIN_PASSWORD_MAX_LENGTH = 128;
const ADMIN_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const IDLE_ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "pointerdown",
  "keydown",
  "scroll",
  "touchstart",
];

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

function initialsFromName(name: string) {
  const cleaned = name.trim();
  if (cleaned.length === 0) {
    return "A";
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 1).toUpperCase();
  }

  return `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`.toUpperCase();
}

export default function AdminProfileShortcut() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [username, setUsername] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<LoginFieldErrors>({});
  const [loginFeedback, setLoginFeedback] = useState<FeedbackMessage | null>(null);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [isSyncingSession, setIsSyncingSession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const loginUsernameInputRef = useRef<HTMLInputElement | null>(null);

  const syncSession = useCallback(async () => {
    setIsSyncingSession(true);

    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        setIsAuthenticated(false);
        setIsAdmin(false);
        setIsViewOnly(false);
        setUsername("");
        return;
      }

      const payload = (await response.json()) as AuthSessionApiResponse;
      const nextIsAuthenticated = payload.isAuthenticated === true;
      const nextIsAdmin = nextIsAuthenticated && payload.isAdmin === true;
      const nextIsViewOnly = nextIsAuthenticated && payload.isViewOnly === true;
      const nextUsername =
        nextIsAuthenticated && typeof payload.username === "string" ? payload.username.trim() : "";

      setIsAuthenticated(nextIsAuthenticated);
      setIsAdmin(nextIsAdmin);
      setIsViewOnly(nextIsViewOnly);
      setUsername(nextUsername);
    } catch {
      setIsAuthenticated(false);
      setIsAdmin(false);
      setIsViewOnly(false);
      setUsername("");
    } finally {
      setIsSyncingSession(false);
    }
  }, []);

  useEffect(() => {
    void syncSession();
  }, [syncSession]);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const logout = useCallback(
    async (reason: "manual" | "idle" = "manual") => {
      if (isSubmitting) {
        return;
      }

      setIsSubmitting(true);

      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
          keepalive: reason === "idle",
        });

        if (!response.ok) {
          throw new Error("Gagal logout admin.");
        }
      } catch {
        // Continue clearing local auth state to prevent stale admin UI.
      } finally {
        setIsAdmin(false);
        setIsAuthenticated(false);
        setIsViewOnly(false);
        setUsername("");
        setIsMenuOpen(false);
        clearIdleTimer();

        if (reason === "idle") {
          setLoginPassword("");
          setLoginErrors({});
          setLoginFeedback({
            type: "info",
            text: "Sesi admin berakhir karena tidak ada aktivitas selama 5 menit. Silakan login ulang.",
          });
          setIsLoginModalOpen(true);
        } else {
          window.dispatchEvent(new Event("engagement:gate-reset"));
        }

        router.refresh();
        setIsSubmitting(false);
      }
    },
    [clearIdleTimer, isSubmitting, router]
  );

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();

    if (!isAuthenticated) {
      return;
    }

    idleTimerRef.current = window.setTimeout(() => {
      void logout("idle");
    }, ADMIN_IDLE_TIMEOUT_MS);
  }, [clearIdleTimer, isAuthenticated, logout]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearIdleTimer();
      return;
    }

    const onActivity = () => {
      resetIdleTimer();
    };

    resetIdleTimer();

    for (const eventName of IDLE_ACTIVITY_EVENTS) {
      window.addEventListener(eventName, onActivity);
    }

    return () => {
      clearIdleTimer();

      for (const eventName of IDLE_ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, onActivity);
      }
    };
  }, [clearIdleTimer, isAuthenticated, resetIdleTimer]);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      if (!containerRef.current) {
        return;
      }

      if (!(event.target instanceof Node)) {
        return;
      }

      if (!containerRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isLoginModalOpen) {
          if (!isLoginSubmitting) {
            setIsLoginModalOpen(false);
            setLoginPassword("");
            setLoginErrors({});
            setLoginFeedback(null);
          }
          return;
        }

        setIsMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isLoginModalOpen, isLoginSubmitting]);

  useEffect(() => {
    if (!isLoginModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      loginUsernameInputRef.current?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [isLoginModalOpen]);

  const avatarLabel = useMemo(() => initialsFromName(username || "Admin"), [username]);
  const title = isAdmin ? "Menu admin" : isViewOnly ? "Menu view mode" : "Menu login admin";
  const menuButtonText = isAuthenticated ? "Logout" : "Login";
  const isLoginDataValid = useMemo(
    () => Object.keys(validateLoginFields(loginUsername, loginPassword)).length === 0,
    [loginPassword, loginUsername]
  );

  const toggleMenu = () => {
    setIsMenuOpen((current) => {
      const next = !current;
      if (next) {
        void syncSession();
      }
      return next;
    });
  };

  const openLoginModal = () => {
    setIsMenuOpen(false);
    setLoginPassword("");
    setLoginErrors({});
    setLoginFeedback(null);
    setLoginUsername((current) => (current.trim().length > 0 ? current : username));
    setIsLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    if (isLoginSubmitting) {
      return;
    }

    setIsLoginModalOpen(false);
    setLoginPassword("");
    setLoginErrors({});
    setLoginFeedback(null);
  };

  const login = async (event: FormEvent<HTMLFormElement>) => {
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

      const nextUsername =
        typeof payload?.username === "string" && payload.username.trim().length > 0
          ? payload.username.trim()
          : normalizedUsername;

      setIsAuthenticated(true);
      setIsAdmin(true);
      setIsViewOnly(false);
      setUsername(nextUsername);
      setLoginUsername(nextUsername);
      setLoginPassword("");
      setLoginErrors({});
      setLoginFeedback(null);
      setIsLoginModalOpen(false);
      setIsMenuOpen(false);
      resetIdleTimer();
      router.refresh();
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
      <div className={`admin-profile-shell${isMenuOpen ? " is-open" : ""}`} ref={containerRef}>
        <button
          type="button"
          className="admin-profile-shortcut"
          title={title}
          aria-label={title}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          onClick={toggleMenu}
        >
          <span className="admin-profile-shortcut-avatar">{avatarLabel}</span>
          <span className="admin-profile-shortcut-copy">
            <span className="admin-profile-shortcut-label">
              {isAuthenticated ? username || "Admin" : "Admin"}
            </span>
            <span className="admin-profile-shortcut-caption">
              {isAdmin ? "Admin Aktif" : isViewOnly ? "View Mode" : "Login Admin"}
            </span>
          </span>
          <span className="admin-profile-shortcut-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M6 9.25L12 15.25L18 9.25"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>

        <div className="admin-profile-dropdown" role="menu" aria-hidden={!isMenuOpen}>
          <p className="admin-profile-dropdown-status">
            {isSyncingSession
              ? "Memuat status..."
              : isAdmin
                ? "Admin sedang login"
                : isViewOnly
                  ? "View mode aktif"
                  : "Belum login"}
          </p>
          {isAuthenticated ? (
            <button
              className="admin-profile-menu-item is-danger"
              role="menuitem"
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                void logout("manual");
              }}
            >
              {isSubmitting ? "Memproses..." : menuButtonText}
            </button>
          ) : (
            <button
              className="admin-profile-menu-item"
              role="menuitem"
              type="button"
              onClick={openLoginModal}
            >
              {menuButtonText}
            </button>
          )}
        </div>
      </div>

      {isLoginModalOpen && (
        <div
          className="admin-login-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeLoginModal();
            }
          }}
        >
          <section
            className="admin-login-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-login-modal-title"
          >
            <div className="admin-login-modal-head">
              <h2 id="admin-login-modal-title">Login Admin</h2>
              <button
                className="button button-ghost admin-login-modal-close"
                type="button"
                onClick={closeLoginModal}
                disabled={isLoginSubmitting}
              >
                Tutup
              </button>
            </div>

            <form className="admin-login-modal-form" onSubmit={login}>
              <label className="field-label">
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
                  aria-describedby={loginErrors.username ? "admin-login-modal-username-error" : undefined}
                  onChange={(event) => {
                    setLoginUsername(event.target.value);
                    setLoginErrors((current) =>
                      current.username ? { ...current, username: undefined } : current
                    );
                  }}
                  required
                />
                {loginErrors.username && (
                  <span className="field-error" id="admin-login-modal-username-error">
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
                  value={loginPassword}
                  minLength={LOGIN_PASSWORD_MIN_LENGTH}
                  maxLength={LOGIN_PASSWORD_MAX_LENGTH}
                  aria-invalid={Boolean(loginErrors.password)}
                  aria-describedby={loginErrors.password ? "admin-login-modal-password-error" : undefined}
                  onChange={(event) => {
                    setLoginPassword(event.target.value);
                    setLoginErrors((current) =>
                      current.password ? { ...current, password: undefined } : current
                    );
                  }}
                  required
                />
                {loginErrors.password && (
                  <span className="field-error" id="admin-login-modal-password-error">
                    {loginErrors.password}
                  </span>
                )}
              </label>

              <button
                className="button button-primary admin-login-modal-submit"
                disabled={isLoginSubmitting || !isLoginDataValid}
                type="submit"
              >
                {isLoginSubmitting ? "Memproses..." : "Login Admin"}
              </button>
            </form>
            {loginFeedback && <p className={`feedback feedback-${loginFeedback.type}`}>{loginFeedback.text}</p>}
          </section>
        </div>
      )}
    </>
  );
}
