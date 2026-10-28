// E2E tests write real rows (sessions, orders, payments). They must only ever run against the
// dev project. Checked when the config loads (before the web server starts) and in global setup.
const PROD_REF = "sxwcsxyalzblvkhtlola"; // tabletap
const DEV_REF = "kozwhezqksupsstvunka"; // tabletap-dev

export function assertDevDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (url.includes(PROD_REF)) {
    throw new Error(
      `E2E refused: NEXT_PUBLIC_SUPABASE_URL points to PRODUCTION (${PROD_REF}). ` +
        `Point .env.local at tabletap-dev (${DEV_REF}). E2E never runs against prod.`,
    );
  }
  if (!url.includes(DEV_REF)) {
    throw new Error(`E2E refused: NEXT_PUBLIC_SUPABASE_URL is not the dev project (${DEV_REF}).`);
  }
}
