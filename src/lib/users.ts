import type { Pool, PoolClient } from "pg";
import { getDbPool } from "@/lib/db";
import { hashPassword, normalizeUsername, verifyPassword } from "@/lib/auth";

type DatabaseClient = Pick<Pool, "query"> | Pick<PoolClient, "query">;

type UserRow = {
  id: number | string;
  username: string;
  password_hash: string;
};

export type RegisterUserInput = {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email: string;
  birthPlace: string;
  birthDate: string;
  phoneCountryCode: string;
  phoneNumber: string;
};

export type AuthUser = {
  id: number;
  username: string;
};

const HARDCODED_LOGIN = {
  username: "afghany",
  password: "fatimatuz2006",
} as const;

function parseUserId(rawId: number | string, username: string) {
  const parsedId =
    typeof rawId === "number"
      ? rawId
      : Number.parseInt(String(rawId), 10);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new Error(`ID user tidak valid untuk akun ${username}.`);
  }

  return parsedId;
}

export class DuplicateUsernameError extends Error {
  constructor() {
    super("Username sudah terdaftar.");
    this.name = "DuplicateUsernameError";
  }
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("Email sudah terdaftar.");
    this.name = "DuplicateEmailError";
  }
}

let schemaEnsured = false;

async function ensureUsersSchema(client: DatabaseClient) {
  if (schemaEnsured) {
    return;
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      birth_place TEXT,
      birth_date DATE,
      phone_country_code TEXT,
      phone_number TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS first_name TEXT;
  `);

  await client.query(`
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS last_name TEXT;
  `);

  await client.query(`
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS email TEXT;
  `);

  await client.query(`
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS birth_place TEXT;
  `);

  await client.query(`
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS birth_date DATE;
  `);

  await client.query(`
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS phone_country_code TEXT;
  `);

  await client.query(`
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS phone_number TEXT;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS app_users_created_at_idx
    ON app_users (created_at DESC, id DESC);
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_unique_idx
    ON app_users (LOWER(email))
    WHERE email IS NOT NULL;
  `);

  schemaEnsured = true;
}

async function findUserByUsername(client: DatabaseClient, username: string) {
  const result = await client.query<UserRow>(
    `
      SELECT id, username, password_hash
      FROM app_users
      WHERE username = $1
      LIMIT 1
    `,
    [username]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

async function ensureHardcodedUser(client: DatabaseClient): Promise<AuthUser> {
  const existingUser = await findUserByUsername(client, HARDCODED_LOGIN.username);
  if (existingUser) {
    return {
      id: parseUserId(existingUser.id, existingUser.username),
      username: existingUser.username,
    };
  }

  const passwordHash = await hashPassword(HARDCODED_LOGIN.password);
  const result = await client.query<Pick<UserRow, "id" | "username">>(
    `
      INSERT INTO app_users (username, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (username) DO UPDATE
      SET username = EXCLUDED.username
      RETURNING id, username
    `,
    [HARDCODED_LOGIN.username, passwordHash]
  );

  const user = result.rows[0];

  return {
    id: parseUserId(user.id, user.username),
    username: user.username,
  };
}

export async function ensureUsersSchemaReady() {
  const pool = getDbPool();
  await ensureUsersSchema(pool);
}

export async function registerUser(input: RegisterUserInput): Promise<AuthUser> {
  const normalizedUsername = normalizeUsername(input.username);

  if (!normalizedUsername) {
    throw new Error("Username tidak valid.");
  }

  const passwordHash = await hashPassword(input.password);
  const pool = getDbPool();
  await ensureUsersSchema(pool);

  try {
    const result = await pool.query<Pick<UserRow, "id" | "username">>(
      `
        INSERT INTO app_users (
          username,
          password_hash,
          first_name,
          last_name,
          email,
          birth_place,
          birth_date,
          phone_country_code,
          phone_number
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9)
        RETURNING id, username
      `,
      [
        normalizedUsername,
        passwordHash,
        input.firstName,
        input.lastName,
        input.email,
        input.birthPlace,
        input.birthDate,
        input.phoneCountryCode,
        input.phoneNumber,
      ]
    );

    const user = result.rows[0];

    return {
      id: parseUserId(user.id, user.username),
      username: user.username,
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      if ("constraint" in error && error.constraint === "app_users_email_unique_idx") {
        throw new DuplicateEmailError();
      }

      throw new DuplicateUsernameError();
    }

    throw error;
  }
}

export async function verifyUserCredential(username: string, password: string): Promise<AuthUser | null> {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername || !password) {
    return null;
  }

  const pool = getDbPool();
  await ensureUsersSchema(pool);

  if (normalizedUsername === HARDCODED_LOGIN.username) {
    if (password !== HARDCODED_LOGIN.password) {
      return null;
    }

    return ensureHardcodedUser(pool);
  }

  const existingUser = await findUserByUsername(pool, normalizedUsername);

  if (!existingUser) {
    return null;
  }

  const isPasswordValid = await verifyPassword(password, existingUser.password_hash);
  if (!isPasswordValid) {
    return null;
  }

  return {
    id: parseUserId(existingUser.id, existingUser.username),
    username: existingUser.username,
  };
}
