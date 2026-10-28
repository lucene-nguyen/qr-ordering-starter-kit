-- LEARNING-97 · Move staff_role() out of the API schema.
-- Security advisor 0029: a SECURITY DEFINER function in `public` is callable over
-- /rest/v1/rpc. `private` is not exposed by the API, but policies can still call it.
-- Policies reference the function by id, so they keep working after the move.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.staff_role() set schema private;
