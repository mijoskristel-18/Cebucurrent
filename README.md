# Cebu Current

A friendly, Cebu-focused local-news concept built with Next.js. Cebu Current links to reporting from Cebu publishers and includes optional Supabase reader accounts, in-site security alerts, five-minute sign-in protection, and an admin activity view. It is set up for its own GitHub repository, Supabase account/project, Vercel account/project, and production URL, separate from Bohol Beacon.

## Run locally

1. Install Node.js LTS.
2. From this folder, run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in your Supabase values when ready.
4. Run `npm run dev` and open the local URL printed in the terminal.

The public news page works without Supabase. Accounts and security features need Supabase configuration and the SQL in `supabase/schema.sql`.

See [DEPLOY.md](./DEPLOY.md) for the GitHub, Supabase, Vercel, and account setup steps. Keep the repository private if it will contain course or project-specific material, and never commit an actual environment file or secret key.
