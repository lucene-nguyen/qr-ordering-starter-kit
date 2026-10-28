// Pure: which Supabase project a deployment uses, from the public URL only. No imports, so
// `node --test` runs it; src/lib/db-env.ts feeds it the real environment.
export const PROD_REF = "sxwcsxyalzblvkhtlola"; // tabletap
export const DEV_REF = "kozwhezqksupsstvunka"; // tabletap-dev

export function databaseTarget(supabaseUrl: string | undefined, vercelEnv: string | undefined) {
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(supabaseUrl ?? "")?.[1] ?? "unknown";
  const deployment = vercelEnv || "local"; // production | preview | development | local
  return {
    ref,
    deployment,
    label: ref === PROD_REF ? "PROD DB" : ref === DEV_REF ? "DEV DB" : "DB",
    // Preview builds run unmerged code; against prod they could write with a schema prod doesn't have.
    misconfigured: deployment === "preview" && ref === PROD_REF,
  };
}
