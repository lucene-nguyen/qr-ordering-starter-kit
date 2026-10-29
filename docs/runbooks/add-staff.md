# Runbook – add a staff member

Sign-ups are turned off on prod (Supabase `tabletap` → Authentication → Sign In / Providers →
"Allow new users to sign up" = off, since 2026-10-29). Staff accounts are created by the owner only.

New staff member: Supabase Dashboard → Authentication → **Add user** (email + password, Auto Confirm
User), then add their `staff_profiles` row with the role through SQL:

```sql
-- SQL Editor of the same project. role: 'owner' | 'cashier' | 'kitchen'
insert into public.staff_profiles (user_id, display_name, role)
select u.id, 'Lan', 'cashier' from auth.users u where u.email = 'lan@example.com';
-- 1 row inserted. 0 rows means the email doesn't match the account created above.
```

- An account without a `staff_profiles` row can sign in, but it gets "This account has no staff
  access".
- The password never goes into the repo or into a chat; the staff member is told it in person.
