# supabase

Two Supabase projects (split at the start of LEARNING-99):

| Env | Project | Ref | Used by |
|---|---|---|---|
| **dev** | `tabletap-dev` | `kozwhezqksupsstvunka` | `.env.local`, Vercel Preview + Development, E2E tests, seed data |
| **prod** | `tabletap` | `sxwcsxyalzblvkhtlola` | Vercel Production only |

- `migrations/` – one SQL file per change, named `YYYYMMDDHHMMSS_name.sql`. **The files are the source
  of truth**; both projects must end up with exactly these, in this order.
- `seed.sql` – demo data matching the prototype (Phở Mây Kitchen, tables 01–12, sample orders,
  staff profiles for accounts that exist). **Dev only.**

## Changing the schema

1. **Write a new migration file** in `migrations/` (never edit one that was already applied).
2. **Apply it to dev**:
   ```bash
   npx supabase login                                      # once per machine
   npx supabase link --project-ref kozwhezqksupsstvunka    # once; asks for the dev DB password
   npx supabase db push                                    # applies files in migrations/ not yet on dev
   ```
   `db push` only reads `supabase/migrations/`; it never touches prod unless you link prod.
3. **Regenerate types from dev** and commit them with the migration:
   Supabase MCP `generate_typescript_types` (project `kozwhezqksupsstvunka`) →
   `src/lib/supabase/database.types.ts`.
4. **Test on dev**: SQL tests, `npm run test:e2e`, Security Advisor.
5. **Prod – only after the owner approves**: apply the same file by hand (SQL Editor or a separate
   Claude session with the Supabase MCP), **with the same migration name as on dev**. Then run the
   Security Advisor on prod and check prod still matches dev (see "Comparing dev and prod").

Never run `seed.sql` or tests against prod. E2E refuses to start when `.env.local` points at prod.

## One-time: align migration history before the first `db push`

The first six migrations were applied through the Supabase MCP, which records the *time of applying*
as the version (e.g. `20261028082015`) instead of the file's timestamp (`20261028000000`). Without
fixing that, `db push` thinks nothing was applied and tries to create every table again.
Run once on **dev** after `supabase link` (this edits only the history table, not the schema):

```bash
npx supabase migration repair --status reverted 20261028082015 20261028082039 20261028082053 20261028082058 20261028082610 20261028082631
npx supabase migration repair --status applied  20261028000000 20261028100000 20261028200000 20261028201000 20261028300000 20261028301000
npx supabase migration list   # local and remote columns should now match
```

Prod is applied by hand, so its history can keep the MCP versions; what must match is the schema.

## Comparing dev and prod

Run the same fingerprint query on both projects and compare the hashes per group (columns,
constraints, indexes, policies, RLS flags, table/column grants, function privileges and
definitions, realtime publication). Sort inside `string_agg(... order by line)` – `order by 1`
inside an aggregate sorts by the constant 1, i.e. not at all, and makes equal schemas look different.

## Staff accounts

Created per environment in Dashboard → Authentication → Users (Auto Confirm User); passwords never go
in the repo. Then run the "staff profiles" block of `seed.sql` (dev) or the same insert with the real
emails (prod). Turn off "Allow new users to sign up" on both projects.
