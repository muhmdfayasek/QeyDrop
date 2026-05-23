# QeyDrop

<img src="public/favicon.svg" alt="QeyDrop Logo" width="80" height="80" />

QeyDrop is a lightweight keyword-based link directory built for collecting, searching, and opening curated links from one clean interface. It uses a React frontend with Supabase as the backend, making it easy to browse the latest collections or search for a specific keyword instantly.

This project was created using the AI coding agent Codex.

## Features

- Browse the 10 latest keyword collections
- Search collections with fast partial keyword matching
- Open grouped links from a simple single-page UI
- Use a read-only Supabase setup protected by Row Level Security

## Tech Stack

- React
- Vite
- Tailwind CSS
- Supabase
- Vercel Analytics

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Create a `.env` file and add your Supabase credentials:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

3. Start the development server:

```bash
pnpm dev
```

## Database Setup

Run the SQL in [supabase/schema.sql](supabase/schema.sql) to create the required tables, indexes, admin helpers, and Row Level Security policies.

The public frontend uses the Supabase anon key for `SELECT` queries. Row Level Security is enabled on both `collections` and `links`, and writes are allowed only when the signed-in account matches the configured admin `auth.uid()` and stored admin email.

## Admin Setup

The `/admin` route is a real page, but it is not trusted for authorization. Database RLS is the actual protection.

1. In the Supabase dashboard, disable public signup in Auth settings.
2. Manually create the single admin user in Supabase Auth.
3. Run [supabase/schema.sql](supabase/schema.sql).
4. In the Supabase SQL editor, register that auth user as the only admin:

```sql
select public.configure_admin_account('admin@example.com');
```

After that:

- `anon` and non-admin authenticated users can only `SELECT`.
- Only the configured admin user can `INSERT`, `UPDATE`, or `DELETE`.
- The frontend does not expose signup. The admin login accepts an entered email, then verifies the signed-in account against the admin email stored in the database.

If admin login still shows that the account does not match, rerun the full [supabase/schema.sql](supabase/schema.sql) so the latest `is_admin_login_user` and `is_admin_user` function definitions are applied, then run:

```sql
select public.configure_admin_account('admin@example.com');
```

## Sample Data

Example CSV files are available in [test-data/collections.csv](test-data/collections.csv) and [test-data/links.csv](test-data/links.csv).

Import `collections.csv` first if you want starter records. The `links.csv` file is keyword-oriented for readability, so it works best as a reference when preparing inserts for the `links` table.

## Build

```bash
pnpm run build
```

## Analytics

QeyDrop includes **Vercel Analytics** for tracking user interactions and gathering insights about how the application is being used. This helps optimize the user experience and understand feature usage patterns. Analytics data is collected automatically and does not impact performance.

## Deployment

This project is optimized for deployment on **Vercel**, which provides:

- Seamless integration with Vercel Analytics
- Fast global CDN for serving static assets
- Automatic deployments from Git
- Built-in performance monitoring
- Environment variable management

To deploy on Vercel, simply connect your GitHub repository and Vercel will automatically build and deploy your application on every push.

`vercel.json` includes an SPA rewrite for `/admin` so the admin page can be loaded directly.
