"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Calendar, DateField, DatePicker, Label } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { FaEyeSlash, FaRegEye } from "react-icons/fa";
import {
  PHONE_COUNTRY_CODE_OPTIONS,
  type RegistrationFieldErrors,
  type RegistrationProfilePayload,
  validateRegistrationProfile,
} from "@/lib/registration-validation";

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

type AuthFieldErrors = RegistrationFieldErrors & {
  username?: string;
  password?: string;
  confirmPassword?: string;
};

type RegistrationFormState = Required<RegistrationProfilePayload>;

type AuthLoginApiResponse = {
  username?: string;
  fieldErrors?: AuthFieldErrors;
  error?: string;
};

type AuthFormMode = "login" | "register";

type FeedbackType = "success" | "error" | "info";

type FeedbackMessage = {
  type: FeedbackType;
  text: string;
};

const SPLASH_DURATION_MS = 3600;
const EXIT_ANIMATION_MS = 620;

const LOGIN_USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const REGISTER_USERNAME_PATTERN = /^[A-Za-z0-9]+$/;
const LOGIN_USERNAME_MIN_LENGTH = 3;
const LOGIN_USERNAME_MAX_LENGTH = 32;
const LOGIN_PASSWORD_MIN_LENGTH = 8;
const MIN_BIRTH_YEAR = 1900;

function validatePasswordField(passwordRaw: string): string | undefined {
  const password = passwordRaw.trim();

  if (!password) {
    return "Password wajib diisi.";
  }

  if (password.length < LOGIN_PASSWORD_MIN_LENGTH) {
    return `Password minimal ${LOGIN_PASSWORD_MIN_LENGTH} karakter.`;
  }

  return undefined;
}

function validateConfirmPasswordField(
  passwordRaw: string,
  confirmPasswordRaw: string
): string | undefined {
  const confirmPassword = confirmPasswordRaw.trim();

  if (!confirmPassword) {
    return "Konfirmasi password wajib diisi.";
  }

  if (passwordRaw.trim() !== confirmPassword) {
    return "Konfirmasi password tidak sama.";
  }

  return undefined;
}

function validateRegisterUsernameField(usernameRaw: string): string | undefined {
  const trimmedUsername = usernameRaw.trim();

  if (!trimmedUsername) {
    return "Username wajib diisi.";
  }

  if (
    trimmedUsername.length < LOGIN_USERNAME_MIN_LENGTH ||
    trimmedUsername.length > LOGIN_USERNAME_MAX_LENGTH
  ) {
    return `Username harus ${LOGIN_USERNAME_MIN_LENGTH}-${LOGIN_USERNAME_MAX_LENGTH} karakter.`;
  }

  if (!REGISTER_USERNAME_PATTERN.test(usernameRaw)) {
    return "Username hanya boleh huruf dan angka tanpa spasi atau simbol.";
  }

  return undefined;
}

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

function validateLoginFields(usernameRaw: string, passwordRaw: string): AuthFieldErrors {
  const username = usernameRaw.trim();
  const fieldErrors: AuthFieldErrors = {};

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

  const passwordError = validatePasswordField(passwordRaw);
  if (passwordError) {
    fieldErrors.password = passwordError;
  }

  return fieldErrors;
}

function validateRegisterFields(
  usernameRaw: string,
  passwordRaw: string,
  confirmPasswordRaw: string,
  profilePayload: RegistrationProfilePayload
): AuthFieldErrors {
  const profileValidation = validateRegistrationProfile(profilePayload);
  const fieldErrors: AuthFieldErrors = {
    ...profileValidation.fieldErrors,
  };

  const usernameError = validateRegisterUsernameField(usernameRaw);
  if (usernameError) {
    fieldErrors.username = usernameError;
  }

  const passwordError = validatePasswordField(passwordRaw);
  if (passwordError) {
    fieldErrors.password = passwordError;
  }

  const confirmPasswordError = validateConfirmPasswordField(passwordRaw, confirmPasswordRaw);
  if (confirmPasswordError) {
    fieldErrors.confirmPassword = confirmPasswordError;
  }

  return fieldErrors;
}

const DEFAULT_REGISTRATION_FORM: RegistrationFormState = {
  firstName: "",
  lastName: "",
  email: "",
  birthPlace: "",
  birthDate: "",
  phoneCountryCode: PHONE_COUNTRY_CODE_OPTIONS[0]?.value ?? "+62",
  phoneNumber: "",
};

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

function formatTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDateToCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

export default function HomeLoadingGate({ children }: HomeLoadingGateProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(() => !hasPlayedInRuntime);
  const [isExiting, setIsExiting] = useState(false);
  const [stage, setStage] = useState<GateStage>("loading");
  const [authMode, setAuthMode] = useState<AuthFormMode>("login");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerForm, setRegisterForm] = useState<RegistrationFormState>(DEFAULT_REGISTRATION_FORM);
  const [loginErrors, setLoginErrors] = useState<AuthFieldErrors>({});
  const [loginFeedback, setLoginFeedback] = useState<FeedbackMessage | null>(null);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isCountryPickerOpen, setIsCountryPickerOpen] = useState(false);
  const [hasTypedUsername, setHasTypedUsername] = useState(false);
  const [hasTypedPassword, setHasTypedPassword] = useState(false);
  const [hasTypedConfirmPassword, setHasTypedConfirmPassword] = useState(false);
  const loaderContainerRef = useRef<HTMLDivElement | null>(null);
  const loginUsernameInputRef = useRef<HTMLInputElement | null>(null);
  const countryPickerRef = useRef<HTMLLabelElement | null>(null);
  const countryPickerButtonRef = useRef<HTMLButtonElement | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const ignoreSubmitUntilRef = useRef(0);

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
      setAuthMode("login");
      setLoginUsername("");
      setLoginPassword("");
      setRegisterConfirmPassword("");
      setRegisterForm(DEFAULT_REGISTRATION_FORM);
      setIsPasswordVisible(false);
      setIsCountryPickerOpen(false);
      setHasTypedUsername(false);
      setHasTypedPassword(false);
      setHasTypedConfirmPassword(false);
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
  const minBirthDateValue = useMemo(() => parseDate(`${MIN_BIRTH_YEAR}-01-01`), []);
  const maxBirthDateValue = useMemo(() => parseDate(formatTodayIsoDate()), []);
  const selectedBirthDateValue = useMemo(
    () => parseIsoDateToCalendarDate(registerForm.birthDate),
    [registerForm.birthDate]
  );
  const selectedCountryOption = useMemo(
    () =>
      PHONE_COUNTRY_CODE_OPTIONS.find((option) => option.value === registerForm.phoneCountryCode) ??
      PHONE_COUNTRY_CODE_OPTIONS[0] ??
      null,
    [registerForm.phoneCountryCode]
  );

  const isRegisterMode = authMode === "register";
  const shouldUseScrollableOverlay = stage === "auth" && isRegisterMode;

  useEffect(() => {
    if (shouldUseScrollableOverlay) {
      return;
    }

    if (loaderContainerRef.current) {
      loaderContainerRef.current.scrollTop = 0;
    }
  }, [shouldUseScrollableOverlay]);

  useEffect(() => {
    if (isRegisterMode) {
      return;
    }

    setIsCountryPickerOpen(false);
  }, [isRegisterMode]);

  useEffect(() => {
    if (!isCountryPickerOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const pickerNode = countryPickerRef.current;
      if (!pickerNode) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && pickerNode.contains(target)) {
        return;
      }

      setIsCountryPickerOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setIsCountryPickerOpen(false);
      countryPickerButtonRef.current?.focus();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isCountryPickerOpen]);

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

  const handleLogin = async () => {
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
    setLoginFeedback({ type: "info", text: "Memverifikasi akun..." });
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
        text: resolveRuntimeErrorMessage(error, "Gagal login."),
      });
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (isLoginSubmitting) {
      return;
    }

    const fieldErrors = validateRegisterFields(
      loginUsername,
      loginPassword,
      registerConfirmPassword,
      registerForm
    );

    if (Object.keys(fieldErrors).length > 0) {
      setLoginErrors(fieldErrors);
      setLoginFeedback({ type: "error", text: "Mohon perbaiki form registrasi terlebih dahulu." });
      return;
    }

    setLoginErrors({});
    setLoginFeedback({ type: "info", text: "Membuat akun baru..." });
    setIsLoginSubmitting(true);

    const normalizedUsername = loginUsername.trim();
    const normalizedPassword = loginPassword.trim();
    const normalizedConfirmPassword = registerConfirmPassword.trim();
    const normalizedProfile = validateRegistrationProfile(registerForm).normalized;

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: normalizedUsername,
          password: normalizedPassword,
          confirmPassword: normalizedConfirmPassword,
          firstName: normalizedProfile.firstName,
          lastName: normalizedProfile.lastName,
          email: normalizedProfile.email,
          birthPlace: normalizedProfile.birthPlace,
          birthDate: normalizedProfile.birthDate,
          phoneCountryCode: normalizedProfile.phoneCountryCode,
          phoneNumber: normalizedProfile.phoneNumber,
        }),
      });

      const payload = await parseJsonResponse<AuthLoginApiResponse>(response);
      if (!response.ok) {
        if (payload?.fieldErrors) {
          setLoginErrors(payload.fieldErrors);
        }
        throw new Error(resolveApiErrorMessage(payload, "Registrasi gagal diproses."));
      }

      setAuthMode("login");
      setLoginUsername("");
      setLoginPassword("");
      setRegisterConfirmPassword("");
      setRegisterForm(DEFAULT_REGISTRATION_FORM);
      setHasTypedUsername(false);
      setHasTypedPassword(false);
      setHasTypedConfirmPassword(false);
      setIsCountryPickerOpen(false);
      setLoginErrors({});
      setLoginFeedback({
        type: "success",
        text: "Akun berhasil dibuat. Silakan login dan isi username/password kembali.",
      });

      window.setTimeout(() => {
        loginUsernameInputRef.current?.focus();
      }, 0);
    } catch (error) {
      setLoginFeedback({
        type: "error",
        text: resolveRuntimeErrorMessage(error, "Gagal membuat akun baru."),
      });
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (Date.now() < ignoreSubmitUntilRef.current) {
      return;
    }

    if (isRegisterMode) {
      await handleRegister();
      return;
    }

    await handleLogin();
  };

  const updateRegisterField = <K extends keyof RegistrationFormState>(
    field: K,
    value: RegistrationFormState[K]
  ) => {
    setRegisterForm((current) => ({
      ...current,
      [field]: value,
    }));

    setLoginErrors((current) => {
      if (!current[field]) {
        return current;
      }

      return {
        ...current,
        [field]: undefined,
      };
    });
  };

  const switchAuthMode = (nextMode: AuthFormMode) => {
    ignoreSubmitUntilRef.current = Date.now() + 250;
    setAuthMode(nextMode);
    setIsCountryPickerOpen(false);
    setLoginErrors({});
    setLoginFeedback(null);
    setHasTypedUsername(false);
    setHasTypedPassword(false);
    setHasTypedConfirmPassword(false);

    if (nextMode === "login") {
      setRegisterConfirmPassword("");
    }
  };

  const handleSwitchModeClick = (event: MouseEvent<HTMLButtonElement>, nextMode: AuthFormMode) => {
    event.preventDefault();
    event.stopPropagation();
    switchAuthMode(nextMode);
  };

  const handleCountryTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (isLoginSubmitting) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsCountryPickerOpen(true);
    }
  };

  const handleCountryOptionSelect = (countryCodeValue: string) => {
    updateRegisterField("phoneCountryCode", countryCodeValue);
    setIsCountryPickerOpen(false);
    countryPickerButtonRef.current?.focus();
  };

  return (
    <>
      {children}

      {isVisible && (
        <div
          ref={loaderContainerRef}
          className={`romantic-loader${isExiting ? " is-exiting" : ""}${shouldUseScrollableOverlay ? " is-scrollable" : ""}`}
          role="status"
          aria-live="polite"
        >
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

          <section className="romantic-loader-card" style={cardStyle} aria-label="Loading Budget Dashboard">
            <p className="romantic-loader-eyebrow">Budget Planning Workspace</p>
            <h1 className="romantic-loader-title">Rincian Biaya Lamaran</h1>

            {stage === "loading" && (
              <>
                <p className="romantic-loader-copy">Menyiapkan dashboard budgeting Anda...</p>
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
                  Workspace siap digunakan. Lanjutkan untuk login atau membuat akun baru.
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
                <p className={`romantic-loader-auth-title${isRegisterMode ? " is-register" : ""}`}>
                  {isRegisterMode ? "Buat Akun Baru" : "Login Dulu untuk Melanjutkan"}
                </p>
                {!isRegisterMode ? (
                  <p className="romantic-loader-auth-copy">
                    Demi keamanan data, halaman hanya bisa diakses setelah login.
                  </p>
                ) : null}

                <form className="romantic-loader-auth-form" onSubmit={handleAuthSubmit} noValidate>
                  <label
                    className={`field-label romantic-loader-auth-field romantic-loader-floating-field${loginUsername.trim().length > 0 ? " is-filled" : ""}`}
                  >
                    <input
                      ref={loginUsernameInputRef}
                      className="input"
                      autoComplete="username"
                      placeholder=" "
                      value={loginUsername}
                      minLength={LOGIN_USERNAME_MIN_LENGTH}
                      maxLength={LOGIN_USERNAME_MAX_LENGTH}
                      pattern={isRegisterMode ? "[A-Za-z0-9]+" : "[A-Za-z0-9._-]+"}
                      title={
                        isRegisterMode
                          ? "Gunakan huruf dan angka tanpa spasi atau simbol."
                          : "Gunakan huruf, angka, titik, garis bawah, atau strip."
                      }
                      aria-invalid={Boolean(loginErrors.username)}
                      aria-describedby={loginErrors.username ? "home-loader-username-error" : undefined}
                      onChange={(event) => {
                        const nextUsername = event.target.value;
                        setLoginUsername(nextUsername);

                        if (!isRegisterMode) {
                          setLoginErrors((current) =>
                            current.username ? { ...current, username: undefined } : current
                          );
                          return;
                        }

                        setHasTypedUsername(true);
                        setLoginErrors((current) => {
                          const shouldValidateUsernameLive =
                            hasTypedUsername ||
                            nextUsername.length > 0 ||
                            loginUsername.length > 0 ||
                            Boolean(current.username);

                          if (!shouldValidateUsernameLive) {
                            if (!current.username) {
                              return current;
                            }

                            return {
                              ...current,
                              username: undefined,
                            };
                          }

                          const usernameError = validateRegisterUsernameField(nextUsername);
                          if (usernameError === current.username) {
                            return current;
                          }

                          return {
                            ...current,
                            username: usernameError,
                          };
                        });
                      }}
                      required
                    />
                    <span className="romantic-loader-floating-label">Username</span>
                    {loginErrors.username && (
                      <span className="field-error" id="home-loader-username-error">
                        {loginErrors.username}
                      </span>
                    )}
                  </label>

                  <label
                    className={`field-label romantic-loader-auth-field romantic-loader-floating-field romantic-loader-password-field${loginPassword.trim().length > 0 ? " is-filled" : ""}`}
                  >
                    <div className="romantic-loader-password-wrap">
                      <input
                        className="input"
                        type={isPasswordVisible ? "text" : "password"}
                        autoComplete={isRegisterMode ? "new-password" : "current-password"}
                        placeholder=" "
                        value={loginPassword}
                        minLength={LOGIN_PASSWORD_MIN_LENGTH}
                        aria-invalid={Boolean(loginErrors.password)}
                        aria-describedby={loginErrors.password ? "home-loader-password-error" : undefined}
                        onChange={(event) => {
                          const nextPassword = event.target.value;
                          setLoginPassword(nextPassword);

                          if (!isRegisterMode) {
                            setLoginErrors((current) =>
                              current.password ? { ...current, password: undefined } : current
                            );
                            return;
                          }

                          setHasTypedPassword(true);
                          setLoginErrors((current) => {
                            const nextErrors: AuthFieldErrors = { ...current };
                            const shouldValidatePasswordLive =
                              hasTypedPassword ||
                              nextPassword.length > 0 ||
                              loginPassword.length > 0 ||
                              Boolean(current.password);

                            if (shouldValidatePasswordLive) {
                              const passwordError = validatePasswordField(nextPassword);
                              nextErrors.password = passwordError;
                            } else if (current.password) {
                              nextErrors.password = undefined;
                            }

                            if (
                              isRegisterMode &&
                              (hasTypedConfirmPassword ||
                                registerConfirmPassword.trim().length > 0 ||
                                Boolean(current.confirmPassword))
                            ) {
                              const confirmPasswordError = validateConfirmPasswordField(
                                nextPassword,
                                registerConfirmPassword
                              );
                              nextErrors.confirmPassword = confirmPasswordError;
                            } else if (current.confirmPassword) {
                              nextErrors.confirmPassword = undefined;
                            }

                            return nextErrors;
                          });
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
                        {isPasswordVisible ? <FaEyeSlash aria-hidden size={12} /> : <FaRegEye aria-hidden size={12} />}
                      </button>
                    </div>
                    <span className="romantic-loader-floating-label">Password</span>
                    {loginErrors.password && (
                      <span className="field-error" id="home-loader-password-error">
                        {loginErrors.password}
                      </span>
                    )}
                  </label>

                  {isRegisterMode && (
                    <label
                      className={`field-label romantic-loader-auth-field romantic-loader-floating-field romantic-loader-password-field${registerConfirmPassword.trim().length > 0 ? " is-filled" : ""}`}
                    >
                      <div className="romantic-loader-password-wrap">
                        <input
                          className="input"
                          type={isPasswordVisible ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder=" "
                          value={registerConfirmPassword}
                          minLength={LOGIN_PASSWORD_MIN_LENGTH}
                          aria-invalid={Boolean(loginErrors.confirmPassword)}
                          aria-describedby={
                            loginErrors.confirmPassword ? "home-loader-confirm-password-error" : undefined
                          }
                          onChange={(event) => {
                            const nextConfirmPassword = event.target.value;
                            setRegisterConfirmPassword(nextConfirmPassword);
                            setHasTypedConfirmPassword(true);
                            setLoginErrors((current) => {
                              const nextErrors: AuthFieldErrors = { ...current };
                              const shouldValidateConfirmLive =
                                hasTypedConfirmPassword ||
                                nextConfirmPassword.length > 0 ||
                                registerConfirmPassword.length > 0 ||
                                Boolean(current.confirmPassword);

                              if (shouldValidateConfirmLive) {
                                const confirmPasswordError = validateConfirmPasswordField(
                                  loginPassword,
                                  nextConfirmPassword
                                );
                                nextErrors.confirmPassword = confirmPasswordError;
                              } else if (current.confirmPassword) {
                                nextErrors.confirmPassword = undefined;
                              }

                              return nextErrors;
                            });
                          }}
                          required
                        />
                        <button
                          type="button"
                          className="romantic-loader-password-toggle"
                          onClick={() => setIsPasswordVisible((current) => !current)}
                          aria-label={
                            isPasswordVisible ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"
                          }
                          title={
                            isPasswordVisible ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"
                          }
                        >
                          {isPasswordVisible ? <FaEyeSlash aria-hidden size={12} /> : <FaRegEye aria-hidden size={12} />}
                        </button>
                      </div>
                      <span className="romantic-loader-floating-label">Konfirmasi Password</span>
                      {loginErrors.confirmPassword && (
                        <span className="field-error" id="home-loader-confirm-password-error">
                          {loginErrors.confirmPassword}
                        </span>
                      )}
                    </label>
                  )}

                  {isRegisterMode && (
                    <div className="romantic-loader-register-grid">
                      <div className="romantic-loader-auth-inline">
                        <label
                          className={`field-label romantic-loader-auth-field romantic-loader-floating-field${registerForm.firstName.trim().length > 0 ? " is-filled" : ""}`}
                        >
                          <input
                            className="input"
                            autoComplete="given-name"
                            placeholder=" "
                            value={registerForm.firstName}
                            maxLength={40}
                            aria-invalid={Boolean(loginErrors.firstName)}
                            aria-describedby={loginErrors.firstName ? "home-loader-first-name-error" : undefined}
                            onChange={(event) => {
                              updateRegisterField("firstName", event.target.value);
                            }}
                            required
                          />
                          <span className="romantic-loader-floating-label">Nama Depan</span>
                          {loginErrors.firstName && (
                            <span className="field-error" id="home-loader-first-name-error">
                              {loginErrors.firstName}
                            </span>
                          )}
                        </label>

                        <label
                          className={`field-label romantic-loader-auth-field romantic-loader-floating-field${registerForm.lastName.trim().length > 0 ? " is-filled" : ""}`}
                        >
                          <input
                            className="input"
                            autoComplete="family-name"
                            placeholder=" "
                            value={registerForm.lastName}
                            maxLength={40}
                            aria-invalid={Boolean(loginErrors.lastName)}
                            aria-describedby={loginErrors.lastName ? "home-loader-last-name-error" : undefined}
                            onChange={(event) => {
                              updateRegisterField("lastName", event.target.value);
                            }}
                            required
                          />
                          <span className="romantic-loader-floating-label">Nama Belakang</span>
                          {loginErrors.lastName && (
                            <span className="field-error" id="home-loader-last-name-error">
                              {loginErrors.lastName}
                            </span>
                          )}
                        </label>
                      </div>

                      <label
                        className={`field-label romantic-loader-auth-field romantic-loader-floating-field${registerForm.email.trim().length > 0 ? " is-filled" : ""}`}
                      >
                        <input
                          className="input"
                          type="email"
                          autoComplete="email"
                          placeholder=" "
                          value={registerForm.email}
                          maxLength={120}
                          aria-invalid={Boolean(loginErrors.email)}
                          aria-describedby={loginErrors.email ? "home-loader-email-error" : undefined}
                          onChange={(event) => {
                            updateRegisterField("email", event.target.value);
                          }}
                          required
                        />
                        <span className="romantic-loader-floating-label">Email</span>
                        {loginErrors.email && (
                          <span className="field-error" id="home-loader-email-error">
                            {loginErrors.email}
                          </span>
                        )}
                      </label>

                      <div className="romantic-loader-auth-inline">
                        <label
                          className={`field-label romantic-loader-auth-field romantic-loader-floating-field${registerForm.birthPlace.trim().length > 0 ? " is-filled" : ""}`}
                        >
                          <input
                            className="input"
                            autoComplete="address-level2"
                            placeholder=" "
                            value={registerForm.birthPlace}
                            maxLength={64}
                            aria-invalid={Boolean(loginErrors.birthPlace)}
                            aria-describedby={
                              loginErrors.birthPlace ? "home-loader-birth-place-error" : undefined
                            }
                            onChange={(event) => {
                              updateRegisterField("birthPlace", event.target.value);
                            }}
                            required
                          />
                          <span className="romantic-loader-floating-label">Tempat Lahir</span>
                          {loginErrors.birthPlace && (
                            <span className="field-error" id="home-loader-birth-place-error">
                              {loginErrors.birthPlace}
                            </span>
                          )}
                        </label>

                        <div className="field-label romantic-loader-auth-field romantic-loader-date-basic-field">
                          <DatePicker
                            className="w-full loader-date-picker"
                            name="birthDate"
                            granularity="day"
                            onOpenChange={(nextOpen) => {
                              if (nextOpen) {
                                setIsCountryPickerOpen(false);
                              }
                            }}
                            value={selectedBirthDateValue}
                            onChange={(nextValue) => {
                              if (!nextValue) {
                                updateRegisterField("birthDate", "");
                                return;
                              }

                              updateRegisterField("birthDate", nextValue.toString());
                            }}
                            minValue={minBirthDateValue}
                            maxValue={maxBirthDateValue}
                            isDisabled={isLoginSubmitting}
                          >
                            <Label className="loader-date-picker__label">Tanggal Lahir</Label>
                            <DateField.Group
                              fullWidth
                              className="loader-date-picker__trigger"
                              aria-describedby={loginErrors.birthDate ? "home-loader-birth-date-error" : undefined}
                            >
                              <DateField.Input className="loader-date-picker__input">
                                {(segment) => (
                                  <DateField.Segment
                                    className="loader-date-picker__segment"
                                    segment={segment}
                                  />
                                )}
                              </DateField.Input>
                              <DateField.Suffix className="loader-date-picker__suffix">
                                <DatePicker.Trigger
                                  className="loader-date-picker__trigger-button"
                                  aria-label="Buka kalender tanggal lahir"
                                >
                                  <DatePicker.TriggerIndicator className="loader-date-picker__trigger-icon" />
                                </DatePicker.Trigger>
                              </DateField.Suffix>
                            </DateField.Group>

                            <DatePicker.Popover className="loader-date-picker__popover">
                              <Calendar
                                aria-label="Kalender tanggal lahir"
                                className="loader-date-picker__calendar"
                                minValue={minBirthDateValue}
                                maxValue={maxBirthDateValue}
                              >
                                <Calendar.Header className="loader-date-picker__calendar-header">
                                  <Calendar.YearPickerTrigger className="loader-date-picker__year-trigger">
                                    <Calendar.YearPickerTriggerHeading className="loader-date-picker__year-heading" />
                                    <Calendar.YearPickerTriggerIndicator className="loader-date-picker__year-indicator" />
                                  </Calendar.YearPickerTrigger>
                                  <div className="loader-date-picker__nav">
                                    <Calendar.NavButton
                                      className="loader-date-picker__nav-button"
                                      slot="previous"
                                    />
                                    <Calendar.NavButton
                                      className="loader-date-picker__nav-button"
                                      slot="next"
                                    />
                                  </div>
                                </Calendar.Header>

                                <Calendar.Grid className="loader-date-picker__grid">
                                  <Calendar.GridHeader className="loader-date-picker__grid-header">
                                    {(day) => <Calendar.HeaderCell className="loader-date-picker__weekday">{day}</Calendar.HeaderCell>}
                                  </Calendar.GridHeader>
                                  <Calendar.GridBody className="loader-date-picker__grid-body">
                                    {(date) => (
                                      <Calendar.Cell className="loader-date-picker__cell" date={date} />
                                    )}
                                  </Calendar.GridBody>
                                </Calendar.Grid>

                                <Calendar.YearPickerGrid className="loader-date-picker__year-grid">
                                  <Calendar.YearPickerGridBody>
                                    {({ year }) => (
                                      <Calendar.YearPickerCell
                                        className="loader-date-picker__year-cell"
                                        year={year}
                                      />
                                    )}
                                  </Calendar.YearPickerGridBody>
                                </Calendar.YearPickerGrid>
                              </Calendar>
                            </DatePicker.Popover>
                          </DatePicker>

                          {loginErrors.birthDate && (
                            <span className="field-error" id="home-loader-birth-date-error">
                              {loginErrors.birthDate}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="romantic-loader-phone-grid">
                        <label
                          ref={countryPickerRef}
                          className={`field-label romantic-loader-auth-field romantic-loader-floating-field romantic-loader-select-field romantic-loader-country-field${registerForm.phoneCountryCode.trim().length > 0 ? " is-filled" : ""}`}
                        >
                          <button
                            ref={countryPickerButtonRef}
                            type="button"
                            className={`romantic-loader-country-trigger${isCountryPickerOpen ? " is-open" : ""}`}
                            aria-label="Pilih kode negara"
                            aria-haspopup="listbox"
                            aria-expanded={isCountryPickerOpen}
                            aria-describedby={
                              loginErrors.phoneCountryCode ? "home-loader-phone-country-error" : undefined
                            }
                            onClick={() => {
                              if (isLoginSubmitting) {
                                return;
                              }

                              setIsCountryPickerOpen((current) => !current);
                            }}
                            onKeyDown={handleCountryTriggerKeyDown}
                            disabled={isLoginSubmitting}
                          >
                            <span className="romantic-loader-country-trigger-flag" aria-hidden>
                              {selectedCountryOption?.flag ?? "🌐"}
                            </span>
                            <span className="romantic-loader-country-trigger-text">
                              {selectedCountryOption
                                ? `${selectedCountryOption.label}`
                                : "Pilih negara dan kode telepon"}
                            </span>
                            <span className="romantic-loader-country-trigger-chevron" aria-hidden>
                              ▾
                            </span>
                          </button>
                          {isCountryPickerOpen && (
                            <div
                              className="romantic-loader-country-menu"
                              role="listbox"
                              aria-label="Daftar kode negara"
                            >
                              {PHONE_COUNTRY_CODE_OPTIONS.map((option) => {
                                const isSelected = option.value === registerForm.phoneCountryCode;

                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`romantic-loader-country-option${isSelected ? " is-selected" : ""}`}
                                    onClick={() => handleCountryOptionSelect(option.value)}
                                  >
                                    <span className="romantic-loader-country-option-flag" aria-hidden>
                                      {option.flag}
                                    </span>
                                    <span className="romantic-loader-country-option-label">{option.label}</span>
                                    {isSelected && (
                                      <span className="romantic-loader-country-option-check" aria-hidden>
                                        ✓
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <span className="romantic-loader-floating-label">Kode Negara</span>
                          {loginErrors.phoneCountryCode && (
                            <span className="field-error" id="home-loader-phone-country-error">
                              {loginErrors.phoneCountryCode}
                            </span>
                          )}
                        </label>

                        <label
                          className={`field-label romantic-loader-auth-field romantic-loader-floating-field${registerForm.phoneNumber.trim().length > 0 ? " is-filled" : ""}`}
                        >
                          <input
                            className="input"
                            inputMode="numeric"
                            autoComplete="tel-national"
                            placeholder=" "
                            value={registerForm.phoneNumber}
                            maxLength={16}
                            aria-invalid={Boolean(loginErrors.phoneNumber)}
                            aria-describedby={loginErrors.phoneNumber ? "home-loader-phone-number-error" : undefined}
                            onChange={(event) => {
                              updateRegisterField("phoneNumber", event.target.value.replace(/\D+/g, ""));
                            }}
                            required
                          />
                          <span className="romantic-loader-floating-label">Nomor Telepon</span>
                          {loginErrors.phoneNumber && (
                            <span className="field-error" id="home-loader-phone-number-error">
                              {loginErrors.phoneNumber}
                            </span>
                          )}
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="romantic-loader-auth-actions">
                    {isRegisterMode ? (
                      <>
                        <button
                          className="button button-primary romantic-loader-auth-submit romantic-loader-register-button"
                          disabled={isLoginSubmitting}
                          type="submit"
                        >
                          {isLoginSubmitting ? "Memproses..." : "Daftar & Masuk"}
                        </button>
                        <button
                          className="button button-ghost romantic-loader-register-button"
                          disabled={isLoginSubmitting}
                          type="button"
                          onClick={(event) => handleSwitchModeClick(event, "login")}
                        >
                          Kembali ke Login
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="button button-secondary romantic-loader-view-button"
                          disabled={isLoginSubmitting}
                          type="button"
                          onClick={() => {
                            void handleViewMode();
                          }}
                        >
                          {isLoginSubmitting ? "Memproses..." : "View Mode"}
                        </button>

                        <button
                          className="button button-secondary romantic-loader-auth-submit"
                          disabled={isLoginSubmitting}
                          type="button"
                          onClick={(event) => handleSwitchModeClick(event, "register")}
                        >
                          Registrasi
                        </button>

                        <button
                          className="button button-primary romantic-loader-register-button"
                          disabled={isLoginSubmitting}
                          type="submit"
                        >
                          {isLoginSubmitting ? "Memproses..." : "Login"}
                        </button>
                      </>
                    )}
                  </div>
                </form>

                {!isRegisterMode && (
                  <p className="romantic-loader-auth-helper">
                    Belum punya akun? Klik tombol Registrasi di samping View Mode.
                  </p>
                )}

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
