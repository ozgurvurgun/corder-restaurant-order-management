# Menu - Vite + React

This project was migrated from Next.js to **Vite + React**. The old tree (`app/`, `components/`, `lib/`) remains; the active sources live under `src/`.

## Running

- **Development:** `pnpm run dev` (default port 3002)
- **Build:** `pnpm run build`
- **Preview:** `pnpm run preview`

## Environment

Set `VITE_API_URL=http://localhost:4000` in `.env.local` (replaces the old `NEXT_PUBLIC_API_URL`).

## Usage

In the browser: `http://localhost:3002?restaurant=SLUG` (SLUG = restaurant slug).
