# Qword

<img src="public/favicon.svg" alt="Qword Logo" width="80" height="80" />

Qword is a lightweight keyword-based link directory built for collecting, searching, and opening curated links from one clean interface. It uses a React frontend with Supabase as the backend, making it easy to browse the latest collections or search for a specific keyword instantly.

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

Run the SQL in [supabase/schema.sql](supabase/schema.sql) to create the required tables, indexes, and read-only access policies for public browsing.

The frontend uses the Supabase anon key only for `SELECT` queries. Row Level Security is enabled on both `collections` and `links`, and anonymous users are not granted write access.

## Sample Data

Example CSV files are available in [test-data/collections.csv](test-data/collections.csv) and [test-data/links.csv](test-data/links.csv).

Import `collections.csv` first if you want starter records. The `links.csv` file is keyword-oriented for readability, so it works best as a reference when preparing inserts for the `links` table.

## Build

```bash
pnpm run build
```

## Analytics

Qword includes **Vercel Analytics** for tracking user interactions and gathering insights about how the application is being used. This helps optimize the user experience and understand feature usage patterns. Analytics data is collected automatically and does not impact performance.

## Deployment

This project is optimized for deployment on **Vercel**, which provides:

- Seamless integration with Vercel Analytics
- Fast global CDN for serving static assets
- Automatic deployments from Git
- Built-in performance monitoring
- Environment variable management

To deploy on Vercel, simply connect your GitHub repository and Vercel will automatically build and deploy your application on every push.
