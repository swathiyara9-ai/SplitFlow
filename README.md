# SplitFlow — Premium Shared Ledgers Architecture

SplitFlow is a minimal, premium expense-sharing application (Splitwise alternative) focusing on visual excellence, clean architecture, and a simplified user experience using Next.js 15, React 19, and Supabase.

Unlike Splitwise, SplitFlow has **no phone number inputs, no contact syncing, and no invitations**. Every user receives a permanent **Unique User ID** immediately upon registration (e.g., `SPL-A73KF9`) and can be added to groups instantly.

---

## Technical Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS (v4), Framer Motion, Lucide React, React Hook Form, Zod, TanStack Query
- **Backend**: Supabase Auth, Supabase PostgreSQL, Supabase Storage (`receipts` bucket), Supabase Realtime (Postgres replication)
- **Deployment**: Direct Vercel integration

---

## Project Structure

```
splitflow/
├── actions/             # Next.js Server Actions (Auth, logout actions)
├── app/                 # Next.js App Router Pages
│   ├── (auth)/          # Authentication Routes (login, signup, forgot-password, reset-password)
│   ├── (dashboard)/     # Main Application Layout & Pages
│   │   ├── dashboard/   # Home Dashboard
│   │   ├── groups/      # Groups List & Group Details ([id])
│   │   ├── profile/     # User Profile Page
│   │   └── settings/    # Application Settings
│   └── page.tsx         # Landing Page
├── components/          # Reusable UI Components
│   ├── layout/          # Layout components (Sidebar, Header)
│   └── ui/              # Custom minimal toast notifications (Toast)
├── hooks/               # Custom React Hooks (useRealtimeSubscription)
├── lib/                 # Shared Library Clients (Supabase browser, server, and middleware clients)
├── services/            # Supabase Data Access Services (auth, profile, group, expense, settlement, activity)
├── supabase/            # Database configurations and schemas
│   └── migrations/      # SQL migration scripts (Tables, constraints, triggers, RLS, storage)
├── types/               # TypeScript Declarations & Interfaces
└── utils/               # Helper Functions (optimized greedy debt minimization balances calculations)
```

---

## Database Architecture

The PostgreSQL schema is fully documented and structured with strict relational constraints:
- **`profiles`**: User metadata, avatar links, and automatically generated unique user IDs.
- **`groups`**: Shared expense pools.
- **`group_members`**: Join table mapping users to groups.
- **`expenses`**: Transaction amounts, categories, dates, and optional receipts links.
- **`expense_participants`**: Individual member weights (Equal, Exact amount, or Percentage splits).
- **`settlements`**: Completed peer-to-peer balance clearings.
- **`activity_logs`**: System audit trail (automatically logs creations, settlements, and member joins).

Row Level Security (RLS) is fully configured for every table. Users can only query tables and storage records if they share group membership, isolating data pools completely.

---

## Setup Instructions

### 1. Create a Supabase Project
- Visit [supabase.com](https://supabase.com) and create a free project.
- Obtain your **Project URL** and **Anon Key** from the project settings.

### 2. Apply Database Migration
- Go to the **SQL Editor** in your Supabase Dashboard.
- Copy the contents of the migration file located at `supabase/migrations/01_init.sql`.
- Paste the script into the SQL Editor and click **Run**.
- Ensure that the tables, triggers, search functions, and RLS policies are created successfully.

### 3. Configure Local Settings
- Create a `.env.local` file (or rename `.env.example`) in the project root:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
  ```

### 4. Run the Project Locally
- Open your terminal, change directories to the project root, and execute:
  ```bash
  npm install
  npm run dev
  ```
- Visit `http://localhost:3000` to interact with the application.

---

## Deployment to Vercel

The application is fully compatible with Vercel and can be deployed in under a minute:
1. Push your project files to a GitHub repository.
2. Log in to Vercel, select **Add New Project**, and import your repository.
3. In the environment variables settings on Vercel, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**. Vercel will build your static pages and server components automatically.
