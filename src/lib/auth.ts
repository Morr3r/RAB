import crypto from "node:crypto";

export const ADMIN_COOKIE_NAME = "engagement_admin";
export const VIEW_COOKIE_NAME = "engagement_view";
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 32;
const PASSWORD_MIN_LENGTH = 8;
const AUTH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const AUTH_TOKEN_VERSION = 1;
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEY_LENGTH = 64;
const PBKDF2_DIGEST = "sha512";
const LOGIN_USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const REGISTER_USERNAME_PATTERN = /^[A-Za-z0-9]+$/;

type LoginPayload = {
  username?: string;
  password?: string;
};

type LoginFieldErrors = {
  username?: string;
  password?: string;
};

export type AuthMode = "admin" | "view";

export type AuthSessionPayload = {
  userId: number;
  username: string;
};

type AuthTokenPayload = {
  v: number;
  userId: number;
  username: string;
  mode: AuthMode;
  iat: number;
  exp: number;
};

export type AuthSession = {
  isAdmin: boolean;
  isViewOnly: boolean;
  isAuthenticated: boolean;
  userId: number | null;
  username: string | null;
};

function getAuthSecret() {
  return process.env.AUTH_SECRET?.trim() || "engagement-local-secret";
}

export function normalizeUsername(rawUsername: string) {
  return rawUsername.trim().toLowerCase();
}

export function validateLoginPayload(payload: LoginPayload) {
  const username =
    typeof payload.username === "string" ? normalizeUsername(payload.username) : "";
  const password = typeof payload.password === "string" ? payload.password.trim() : "";
  const fieldErrors: LoginFieldErrors = {};

  if (!username) {
    fieldErrors.username = "Username wajib diisi.";
  } else if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    fieldErrors.username = `Username harus ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} karakter.`;
  } else if (!LOGIN_USERNAME_PATTERN.test(username)) {
    fieldErrors.username = "Username hanya boleh huruf, angka, titik, garis bawah, atau strip.";
  }

  if (!password) {
    fieldErrors.password = "Password wajib diisi.";
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    fieldErrors.password = `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  }

  return {
    username,
    password,
    fieldErrors,
    isValid: Object.keys(fieldErrors).length === 0,
  };
}

export function validateRegisterPayload(payload: LoginPayload) {
  const usernameRaw = typeof payload.username === "string" ? payload.username : "";
  const username = normalizeUsername(usernameRaw);
  const trimmedUsername = usernameRaw.trim();
  const password = typeof payload.password === "string" ? payload.password.trim() : "";
  const fieldErrors: LoginFieldErrors = {};

  if (!trimmedUsername) {
    fieldErrors.username = "Username wajib diisi.";
  } else if (
    trimmedUsername.length < USERNAME_MIN_LENGTH ||
    trimmedUsername.length > USERNAME_MAX_LENGTH
  ) {
    fieldErrors.username = `Username harus ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} karakter.`;
  } else if (!REGISTER_USERNAME_PATTERN.test(usernameRaw)) {
    fieldErrors.username = "Username hanya boleh huruf dan angka tanpa spasi atau simbol.";
  }

  if (!password) {
    fieldErrors.password = "Password wajib diisi.";
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    fieldErrors.password = `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  }

  return {
    username,
    password,
    fieldErrors,
    isValid: Object.keys(fieldErrors).length === 0,
  };
}

function signTokenPayload(encodedPayload: string) {
  return crypto.createHmac("sha256", getAuthSecret()).update(encodedPayload).digest("base64url");
}

function isEqualSignature(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function buildAuthToken(mode: AuthMode, session: AuthSessionPayload) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthTokenPayload = {
    v: AUTH_TOKEN_VERSION,
    userId: session.userId,
    username: normalizeUsername(session.username),
    mode,
    iat: now,
    exp: now + AUTH_TOKEN_MAX_AGE_SECONDS,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signTokenPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function isTokenPayload(value: unknown): value is AuthTokenPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<AuthTokenPayload>;

  return (
    payload.v === AUTH_TOKEN_VERSION &&
    Number.isInteger(payload.userId) &&
    typeof payload.username === "string" &&
    payload.username.trim().length > 0 &&
    (payload.mode === "admin" || payload.mode === "view") &&
    Number.isInteger(payload.iat) &&
    Number.isInteger(payload.exp)
  );
}

function parseAuthToken(token?: string | null): AuthTokenPayload | null {
  if (!token) {
    return null;
  }

  const tokenParts = token.split(".");
  if (tokenParts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = tokenParts;
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signTokenPayload(encodedPayload);
  if (!isEqualSignature(signature, expectedSignature)) {
    return null;
  }

  try {
    const decodedPayload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const payload = JSON.parse(decodedPayload) as unknown;

    if (!isTokenPayload(payload)) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function buildAdminToken(session: AuthSessionPayload) {
  return buildAuthToken("admin", session);
}

export function buildViewToken(session: AuthSessionPayload) {
  return buildAuthToken("view", session);
}

function readTokenByMode(token: string | null | undefined, mode: AuthMode) {
  const parsed = parseAuthToken(token);
  if (!parsed || parsed.mode !== mode) {
    return null;
  }

  return parsed;
}

export function readAdminToken(token?: string | null) {
  return readTokenByMode(token, "admin");
}

export function readViewToken(token?: string | null) {
  return readTokenByMode(token, "view");
}

export function isValidAdminToken(token?: string | null) {
  return readAdminToken(token) !== null;
}

export function isValidViewToken(token?: string | null) {
  return readViewToken(token) !== null;
}

export function resolveAuthSession({
  adminToken,
  viewToken,
}: {
  adminToken?: string | null;
  viewToken?: string | null;
}): AuthSession {
  const adminPayload = readAdminToken(adminToken);
  const viewPayload = readViewToken(viewToken);

  if (adminPayload && viewPayload) {
    // When both cookies are present, prefer the most recently issued token.
    // Tie-breaker is view mode to avoid accidental privilege escalation.
    if (adminPayload.iat > viewPayload.iat) {
      return {
        isAdmin: true,
        isViewOnly: false,
        isAuthenticated: true,
        userId: adminPayload.userId,
        username: adminPayload.username,
      };
    }

    return {
      isAdmin: false,
      isViewOnly: true,
      isAuthenticated: true,
      userId: viewPayload.userId,
      username: viewPayload.username,
    };
  }

  if (adminPayload) {
    return {
      isAdmin: true,
      isViewOnly: false,
      isAuthenticated: true,
      userId: adminPayload.userId,
      username: adminPayload.username,
    };
  }

  if (viewPayload) {
    return {
      isAdmin: false,
      isViewOnly: true,
      isAuthenticated: true,
      userId: viewPayload.userId,
      username: viewPayload.username,
    };
  }

  return {
    isAdmin: false,
    isViewOnly: false,
    isAuthenticated: false,
    userId: null,
    username: null,
  };
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_TOKEN_MAX_AGE_SECONDS,
  };
}

function derivePassword(password: string, salt: string, iterations = PBKDF2_ITERATIONS) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      iterations,
      PBKDF2_KEY_LENGTH,
      PBKDF2_DIGEST,
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      }
    );
  });
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await derivePassword(password, salt);
  return `pbkdf2_sha512$${PBKDF2_ITERATIONS}$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, iterationValue, salt, hashHex] = passwordHash.split("$");

  if (
    algorithm !== "pbkdf2_sha512" ||
    typeof iterationValue !== "string" ||
    typeof salt !== "string" ||
    typeof hashHex !== "string"
  ) {
    return false;
  }

  const iterations = Number.parseInt(iterationValue, 10);
  if (!Number.isInteger(iterations) || iterations < 100_000) {
    return false;
  }

  if (!/^[a-f0-9]+$/i.test(hashHex) || hashHex.length % 2 !== 0) {
    return false;
  }

  const storedHash = Buffer.from(hashHex, "hex");
  const calculatedHash = await derivePassword(password, salt, iterations);

  if (storedHash.length !== calculatedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedHash, calculatedHash);
}
