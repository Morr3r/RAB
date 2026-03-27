CREATE TABLE IF NOT EXISTS public.app_users (
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

ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS birth_place TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS phone_country_code TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS phone_number TEXT;

CREATE INDEX IF NOT EXISTS app_users_created_at_idx
ON public.app_users (created_at DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_unique_idx
ON public.app_users (LOWER(email))
WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_expense_data (
  user_id BIGINT PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  reference_total INTEGER NOT NULL CHECK (reference_total >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  items JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.user_expense_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  page_key TEXT NOT NULL,
  page_label TEXT NOT NULL,
  actor TEXT NOT NULL,
  summary TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS user_expense_history_user_changed_at_idx
ON public.user_expense_history (user_id, changed_at DESC, id DESC);
