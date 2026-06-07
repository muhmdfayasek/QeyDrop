# QeyDrop

<img src="public/favicon.svg" alt="QeyDrop Logo" width="80" height="80" />

QeyDrop is a lightweight keyword-based link directory built for collecting, searching, and opening curated links from one clean interface. It uses one React frontend with two interchangeable data source versions: Supabase Version and Static JSON Version.

This project was created using the AI coding agent Codex.

## Features

- Browse the 10 latest keyword collections
- Search collections with fast partial keyword matching
- Open grouped links from a simple single-page UI
- Choose between a read-only Supabase setup or a static JSON file

## Tech Stack

- React
- Vite
- Tailwind CSS
- Supabase or static JSON
- Vercel Analytics

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Choose a data source in `src/data/activeDataSource.js`.

3. If you are using Supabase Version, create a `.env` file and add your Supabase credentials:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

4. Start the development server:

```bash
pnpm dev
```

## Choosing a Data Source

QeyDrop always imports data access from `src/data/activeDataSource.js`. To switch versions, edit that file manually and export one adapter.

### Static JSON Version

1. Edit `src/data/activeDataSource.js`
2. Use `export * from "./jsonDataSource";`
3. Edit `public/data/links.json`
4. Deploy

Static JSON Version supports the public directory UI only. The `/admin` route shows this message instead of the admin panel:

`Static JSON Version does not support the admin panel. Edit public/data/links.json instead.`

### Supabase Version

1. Edit `src/data/activeDataSource.js`
2. Use `export * from "./supabaseDataSource";`
3. Configure Supabase credentials
4. Deploy

## Optional Cleanup

QeyDrop supports both the Supabase Version and the Static JSON Version in the same repository.

After choosing your preferred version, you may remove unused files to keep the project clean.

### Using the Static JSON Version

You may delete:

- `src/data/supabaseDataSource.js`
- `src/lib/supabase.js`
- Admin page components and related authentication files
- Unused Supabase dependencies
- Supabase environment variables

Keep:

- `src/data/jsonDataSource.js`
- `src/data/activeDataSource.js`
- `public/data/links.json`

### Using the Supabase Version

You may delete:

- `src/data/jsonDataSource.js`
- `public/data/links.json`

Keep:

- `src/data/supabaseDataSource.js`
- `src/data/activeDataSource.js`
- `src/lib/supabase.js`

### Important

Do not delete:

- `src/data/activeDataSource.js`

This file acts as the application's data source adapter and should always remain in the project.

Cleanup is completely optional.

QeyDrop works correctly without deleting any files. Both versions are included intentionally so users can easily switch between the Supabase Version and the Static JSON Version.

Before deleting any files, ensure the application is working correctly with your selected version.

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

If you are using Static JSON Version, edit [public/data/links.json](public/data/links.json) instead.

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
