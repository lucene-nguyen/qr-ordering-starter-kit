# Runbook – release Phase 6 to production · LEARNING-100

Status: **draft, not executed.** The owner (Cuong) applies everything on prod; no agent touches prod.

What goes out:
- **DB (prod `sxwcsxyalzblvkhtlola`):** `20261029150739_phase6_reports.sql`. Apply it with the MCP
  under the name `phase6_reports`.
- **App:** merge PR #3 (`learning-100` → `main`).

## Order: migration first, then merge

| State | Effect |
|---|---|
| **Old code on the new schema** (after the migration, before the merge) | **Safe.** The migration only *adds* three functions and one index; nothing the current code calls changes. |
| **New code on the old schema** (never do this) | `/staff/reports` and the CSV export fail ("function not found"). Everything else works, because no other page calls the report functions. |

1. Apply the migration (MCP `apply_migration`, name `phase6_reports`). It runs in one transaction.
   - The new index briefly locks writes on `table_sessions` while it is built: milliseconds on prod's
     few rows, so no quiet hour is needed.
   - No sessions need closing.
2. Run the checks below and the Security Advisor.
3. Merge PR #3. Wait for the Vercel Production deployment to be **Ready**.
4. Smoke test.

**Never run `supabase/dev/seed-reports.sql` or `cleanup-reports.sql` on prod.** Both refuse
(`NOT_DEV`), but don't try.

## Checks (prod SQL Editor, read-only)

```sql
select name from supabase_migrations.schema_migrations where name = 'phase6_reports';  -- 1 row

select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as definer,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'report\_%' order by 1;
-- 3 rows: report_hours(p_from date, p_to date), report_items(p_from date, p_to date),
-- report_revenue(p_from date, p_to date, p_grain text); definer = false, anon = false, authenticated = true

select indexname from pg_indexes where indexname = 'table_sessions_closed_at_idx';  -- 1 row
```

Then run the dev/prod schema fingerprint (`supabase/README.md`, "Comparing dev and prod"). Dev also
holds the R1 seed data, but that is data, not schema.

## Smoke test (production)

1. **Owner → Reports.**
   - The page loads.
   - "Today so far" and the last 7 days match the tables closed on prod.
   - The smoke-test tables of 2026-10-29 count on that day, if they were closed: the 60.000đ cash
     payment, and also the 15.000đ VietQR payment that was confirmed by mistake. That one stays in
     revenue until the prod test data is cleaned up (ADR 0004, "Void payment" backlog).
2. Switch to 30 days, then Week. The page stays where it was scrolled. Then Export CSV, both files.
3. **Cashier → Reports:** "Reports are for the owner". The `/staff/reports/export` URL returns 403.
4. **Phone, 390 px:** the console nav shows every link without scrolling sideways.
5. Vercel runtime errors for the last 15 minutes: none.
6. Then: Jira LEARNING-100 → Done, and the "released" date in `docs/lessons/phase-6.md`.

## Rollback

- **Preferred: fix forward.** The reports are read-only; nothing a guest or cashier does depends on
  them.
- **The migration fails:** its transaction rolls back and prod is unchanged. Do not merge.
- **The reports must go after the merge:**
  1. Vercel Instant Rollback to the previous Production deployment.
  2. Then `git revert -m 1 <merge commit>` on `main`.
  3. The functions and the index can stay: the old code doesn't call them. To remove them anyway:
     ```sql
     begin;
     drop function public.report_revenue(date, date, text), public.report_items(date, date), public.report_hours(date, date);
     drop index public.table_sessions_closed_at_idx;
     commit;
     ```
     A later re-release then needs a new migration, because `phase6_reports` stays in the history.
