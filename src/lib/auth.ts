import crypto from "node:crypto";

export const ADMIN_COOKIE_NAME = "engagement_admin";
const SESSION_MAX_AGE = 60 * 60 * 8;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 32;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

export function getAdminUsername() {
  return process.env.ADMIN_USERNAME?.trim() || "afghany";
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || "fatimatuz2006";
}

function getAuthSecret() {
  return process.env.AUTH_SECRET?.trim() || "engagement-local-secret";
}

export function verifyCredential(username: string, password: string) {
  return username === getAdminUsername() && password === getAdminPassword();
}

type LoginPayload = {
  username?: string;
  password?: string;
};

type LoginFieldErrors = {
  username?: string;
  password?: string;
};

export function validateLoginPayload(payload: LoginPayload) {
  const username = typeof payload.username === "string" ? payload.username.trim() : "";
  const password = typeof payload.password === "string" ? payload.password.trim() : "";
  const fieldErrors: LoginFieldErrors = {};

  if (!username) {
    fieldErrors.username = "Username wajib diisi.";
  } else if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    fieldErrors.username = `Username harus ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} karakter.`;
  } else if (!/^[A-Za-z0-9._-]+$/.test(username)) {
    fieldErrors.username = "Username hanya boleh huruf, angka, titik, garis bawah, atau strip.";
  }

  if (!password) {
    fieldErrors.password = "Password wajib diisi.";
  } else if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    fieldErrors.password = `Password harus ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} karakter.`;
  }

  return {
    username,
    password,
    fieldErrors,
    isValid: Object.keys(fieldErrors).length === 0,
  };
}

function createTokenPayload() {
  return `${getAdminUsername()}:${getAdminPassword()}`;
}

export function buildAdminToken() {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(createTokenPayload())
    .digest("hex");
}

export function isValidAdminToken(token?: string | null) {
  if (!token) {
    return false;
  }

  return token === buildAdminToken();
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
