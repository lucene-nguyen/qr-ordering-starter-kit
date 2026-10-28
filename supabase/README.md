# supabase

- `migrations/` – one SQL file per change, created from `docs/data-model.md` as each phase needs it
  (e.g. `20261028000000_phase1_menu.sql`). Apply with the Supabase CLI (`supabase db push`) or the SQL editor.
- `seed.sql` – demo data that matches the prototype (Phở Mây Kitchen, tables 01–12).

Applied so far: `20261028000000_phase1_menu.sql` (LEARNING-95). After a migration, regenerate
`src/lib/supabase/database.types.ts`.
