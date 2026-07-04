// delete-account
//
// Invoked by the signed-in user from the profile screen
// (supabase.functions.invoke sends their access token as the Bearer).
// Deletes the caller's own auth.users row with the service_role admin API;
// the FK cascade removes their profile, favorites, devices, notifications
// and notification prefs, while staff attribution (trip_updates.reporter_id,
// service_alerts.created_by, trips.updated_by) is nulled, not deleted
// (migration 10). verify_jwt is on, so unauthenticated calls never reach us,
// but we still resolve the caller from the token — the *only* account this
// function will ever delete.

import { createClient } from "jsr:@supabase/supabase-js@2";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "missing bearer token" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: "invalid token", detail: userErr?.message }, 401);
    }
    // Reject service/anon keys used as user tokens: they carry no user.
    const userId = userData.user.id;

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return json({ error: "deletion failed", detail: delErr.message }, 500);
    }
    return json({ deleted: userId });
  } catch (err) {
    console.error("delete-account fatal", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
