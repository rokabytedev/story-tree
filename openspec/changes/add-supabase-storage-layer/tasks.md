## 1. Database & Tooling
- [x] 1.1 Create Supabase workspace folder with `config.toml`, migrations directory, and setup README.
- [x] 1.2 Write initial migration that provisions the `stories` table plus supporting extensions/triggers.

## 2. Storage Layer Implementation
- [x] 2.1 Add Supabase client factory and typed stories repository with create/update/fetch helpers.
- [x] 2.2 Cover repository behavior with Vitest tests using fakes.

## 3. Automation
- [x] 3.1 Add GitHub Action that deploys migrations to Supabase on merges to `main`.
- [x] 3.2 Document required GitHub secrets and local workflow in README.
