# Supabase Development Guide

The storage layer for interactive stories relies on a Supabase project. Follow this guide to bootstrap a local stack, manage migrations, and prepare CI/CD secrets.

## 1. Install the Supabase CLI

Supabase ships an official CLI via Homebrew, npm, or standalone binaries. Install whichever distribution matches your workstation.

```bash
# macOS
brew install supabase/tap/supabase

# Cross-platform (npm)
npm install -g supabase

# Validate installation
supabase --version
```

Authenticate once so the CLI can connect to your Supabase projects:

```bash
supabase login
```

## 2. Run the Local Stack

The repository includes `supabase/config.toml`; start local services with Docker:

```bash
supabase start
```

The CLI prints generated connection details. Export them (or add them to `.env.local`) so local code can talk to the stack:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=sb-secret-...
```

Stop services when you finish:

```bash
supabase stop
```

## 3. Manage Migrations

All schema changes live under `supabase/migrations/`.

```bash
# Create a new migration (generates a timestamped SQL file)
supabase migration new add_example_change

# Reset the local database and apply every migration
supabase db reset

# Verify schema diff against remote
supabase db diff --schema public
```

After validating locally, push migrations to the remote project:

```bash
supabase db push
```

## 4. Configure Local Environment Variables

Create a `.env.local` file in the **repository root** (`story-tree/.env.local`). This file is git-ignored and is where Node processes (tests, CLIs) read Supabase credentials.

1. Run `supabase start`. The CLI writes environment variables to `.supabase/dev.env`. Copy the generated `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` values into `.env.local`.
2. Ensure the file looks similar to:
   ```
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_SERVICE_ROLE_KEY=sb-secret-abc123
   ```
3. Restart any running `npm` scripts after editing the env file so the new values are picked up.

## 5. Required GitHub Secrets

The GitHub Action that deploys migrations pulls credentials from repository secrets. Populate these in GitHub → Settings → Secrets and variables → Actions:

- `SUPABASE_ACCESS_TOKEN` – Personal access token created in the Supabase dashboard.
- `SUPABASE_PRODUCTION_PROJECT_REF` – The Supabase project reference (e.g. `abcd1234`).
- `SUPABASE_PRODUCTION_DB_PASSWORD` – The database password for the production project.

You can generate a secrets template by running utility scripts from the Supabase CLI (`supabase link --project-ref <ref>`). Ensure the action can link and run `supabase db push` without manual intervention.

### How to Obtain Each Secret

- **SUPABASE_ACCESS_TOKEN**: In the Supabase dashboard, click your avatar → *Access Tokens* → *Generate new token*. Copy the token string into the GitHub secret.
- **SUPABASE_PRODUCTION_PROJECT_REF**: In the Supabase dashboard, open the production project → *Project Settings* → *General*. Copy the *Project reference* value (a short alphanumeric id).
- **SUPABASE_PRODUCTION_DB_PASSWORD**: In the same project, go to *Project Settings* → *Database* → *Connection info*, and copy the *Password* under “Connection string” (this is the service role password you set when creating the project).

## 6. Troubleshooting

- Confirm Docker Desktop is running; Supabase uses containers for Postgres, storage, and authentication.
- Use `supabase status --json` to inspect service health.
- Delete the `.supabase/` folder if you need a clean slate after stopping the stack.
