This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## PostgreSQL (DBeaver) Setup

1. Buat database baru di PostgreSQL, contoh: `engagement_db`.
2. Buka DBeaver dan koneksikan ke server PostgreSQL kamu.
3. Jalankan file SQL ini di DBeaver SQL Editor:
   - `database/postgresql-init.sql`
4. Salin `.env.example` menjadi `.env.local`, lalu isi `DATABASE_URL` sesuai koneksi PostgreSQL kamu.
5. Jalankan aplikasi:

```bash
npm run dev
```

6. Buka `http://localhost:3000`, lalu buat akun dari tab **Registrasi** di halaman login awal.

Contoh `DATABASE_URL`:

```bash
postgresql://postgres:password@localhost:5432/engagement_db
```

Variabel env opsional untuk enkripsi detail history:

```bash
EXPENSE_HISTORY_ENCRYPTION_KEY=isi-secret-panjang-dan-unik
```

Jika `EXPENSE_HISTORY_ENCRYPTION_KEY` tidak diisi, aplikasi akan fallback ke `AUTH_SECRET` (selama bukan default `engagement-local-secret`).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# RAB
