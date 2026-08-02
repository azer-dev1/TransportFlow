// notify-trip-update
//
// Invoked by database webhooks on `trip_updates` INSERT (migration 3) and
// `service_alerts` INSERT (migration 7) — the payload's `table` field says
// which. Either way it fans out to every rider with an unmuted favorite on
// the affected line — or a stop that line serves — by persisting a
// `notifications` row and sending an Expo push (skipped inside a user's
// quiet hours; the row is still written). Runs with the service_role key
// (RLS-bypassing), which the DB webhook passes as a Bearer token and which
// is also injected into the runtime as SUPABASE_SERVICE_ROLE_KEY.
//
// Payload shape (Supabase DB webhook): { type, table, schema, record }.

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

interface TripUpdateRecord {
  id?: string;
  trip_id: string;
  reporter_id?: string;
  status: "on_time" | "delayed" | "cancelled";
  delay_minutes?: number;
}

interface ServiceAlertRecord {
  id: string;
  line_id: string;
  title: string;
  body: string;
  severity?: string;
}

interface NotificationPref {
  user_id: string;
  quiet_start: string | null; // "HH:MM:SS"
  quiet_end: string | null;
  timezone: string;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildMessage(line: string, status: string, delay: number): string {
  switch (status) {
    case "cancelled":
      return `${line} service has been cancelled.`;
    case "delayed":
      return `${line} is delayed by ${delay} min.`;
    case "on_time":
      return `${line} is back on schedule.`;
    default:
      return `${line} status updated: ${status}.`;
  }
}

/** Users with an unmuted favorite on the line, or on a stop the line serves. */
async function fanOutRecipients(
  supabase: SupabaseClient,
  lineId: string,
): Promise<{ userIds: string[]; error?: string }> {
  const { data: lineStops } = await supabase
    .from("line_stops")
    .select("stop_id")
    .eq("line_id", lineId);
  const stopIds = (lineStops ?? []).map((r) => r.stop_id);

  let favQuery = supabase.from("favorites").select("user_id").eq("muted", false);
  favQuery = stopIds.length
    ? favQuery.or(`line_id.eq.${lineId},stop_id.in.(${stopIds.join(",")})`)
    : favQuery.eq("line_id", lineId);
  const { data: favs, error } = await favQuery;
  if (error) return { userIds: [], error: error.message };
  return { userIds: [...new Set((favs ?? []).map((f) => f.user_id))] };
}

/** Current minutes-of-day on a user's wall clock; null if the tz is bogus. */
function minutesOfDayIn(timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value);
    const m = Number(parts.find((p) => p.type === "minute")?.value);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return (h % 24) * 60 + m; // en-GB can render midnight as "24"
  } catch {
    return null;
  }
}

function isQuietNow(pref: NotificationPref): boolean {
  if (!pref.quiet_start || !pref.quiet_end) return false;
  const now = minutesOfDayIn(pref.timezone || "Africa/Tunis");
  if (now === null) return false;
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const start = toMinutes(pref.quiet_start);
  const end = toMinutes(pref.quiet_end);
  if (start === end) return false;
  // A window may wrap midnight (e.g. 22:00-07:00).
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/** Recipients minus anyone currently inside their quiet hours. */
async function filterQuietUsers(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<string[]> {
  const { data: prefs } = await supabase
    .from("notification_prefs")
    .select("user_id, quiet_start, quiet_end, timezone")
    .in("user_id", userIds);
  const quiet = new Set(
    ((prefs ?? []) as NotificationPref[]).filter(isQuietNow).map((p) => p.user_id),
  );
  return userIds.filter((id) => !quiet.has(id));
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ sent: number; staleTokens: string[] }> {
  // Expo tokens look like ExponentPushToken[xxxxxxxx]; skip anything else.
  // channelId must match ANDROID_CHANNEL_ID in mobile/src/lib/notifications.ts
  // — that channel is what carries sound + vibration. Omitting it drops the
  // push onto Expo's fallback "Miscellaneous" channel instead, which the app
  // cannot configure. priority high so a dozing device wakes for it.
  const messages = tokens
    .filter((t) => typeof t === "string" && t.startsWith("ExponentPushToken"))
    .map((to) => ({
      to,
      sound: "default",
      channelId: "trip-updates-v2",
      priority: "high",
      title,
      body,
      data,
    }));
  if (messages.length === 0) return { sent: 0, staleTokens: [] };

  let sent = 0;
  const staleTokens: string[] = [];
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(batch),
      });
      if (res.ok) {
        // Tickets come back in the same order as the batch. A
        // DeviceNotRegistered ticket means the token is permanently dead
        // (app uninstalled / token rotated) and Expo requires we stop
        // sending to it — collect it for deletion. (It can also surface
        // later in receipts, which we don't poll; the *next* fan-out's
        // ticket catches those, so dead tokens still get pruned.)
        const { data: tickets } = await res.json() as { data?: ExpoPushTicket[] };
        (tickets ?? []).forEach((ticket, idx) => {
          if (ticket.status === "ok") {
            sent += 1;
          } else if (ticket.details?.error === "DeviceNotRegistered") {
            staleTokens.push(batch[idx].to);
          } else {
            console.error("Expo push ticket error", ticket.message, ticket.details);
          }
        });
      } else {
        console.error("Expo push HTTP", res.status, await res.text());
      }
    } catch (err) {
      // Push is best-effort — a failed send must not fail the whole webhook,
      // the persisted notification row is the durable record.
      console.error("Expo push error", err);
    }
  }
  return { sent, staleTokens };
}

/**
 * Shared tail of both event types: persist notifications rows for everyone,
 * push only to users outside quiet hours, prune dead device tokens.
 */
async function persistAndPush(
  supabase: SupabaseClient,
  userIds: string[],
  notificationRow: { trip_id?: string; message: string },
  push: { title: string; body: string; data: Record<string, string> },
): Promise<Response> {
  if (userIds.length === 0) {
    return json({ recipients: 0, notifications: 0, devices: 0, push_sent: 0 });
  }

  // Persist notifications (the durable record, readable by each owner via
  // RLS) — including for users in quiet hours; only the push is suppressed.
  const rows = userIds.map((uid) => ({ user_id: uid, ...notificationRow }));
  const { error: notifErr } = await supabase.from("notifications").insert(rows);
  if (notifErr) {
    return json({ error: "notification insert failed", detail: notifErr.message }, 500);
  }

  const pushUserIds = await filterQuietUsers(supabase, userIds);
  let tokens: string[] = [];
  if (pushUserIds.length > 0) {
    const { data: devices } = await supabase
      .from("devices")
      .select("expo_push_token")
      .in("user_id", pushUserIds);
    tokens = [...new Set((devices ?? []).map((d) => d.expo_push_token))];
  }
  const { sent: pushSent, staleTokens } = await sendExpoPush(
    tokens,
    push.title,
    push.body,
    push.data,
  );

  // Prune devices Expo reported as DeviceNotRegistered (app uninstalled)
  // so future fan-outs stop sending into the void. Needs the service_role
  // DELETE grant from migration 6.
  if (staleTokens.length > 0) {
    const { error: pruneErr } = await supabase
      .from("devices")
      .delete()
      .in("expo_push_token", staleTokens);
    if (pruneErr) {
      console.error("stale device prune failed", pruneErr.message);
    }
  }

  return json({
    recipients: userIds.length,
    notifications: rows.length,
    quiet_skipped: userIds.length - pushUserIds.length,
    devices: tokens.length,
    push_sent: pushSent,
    stale_devices_pruned: staleTokens.length,
  });
}

async function handleTripUpdate(
  supabase: SupabaseClient,
  record: TripUpdateRecord,
): Promise<Response> {
  // Trip + line name.
  const { data: trip, error: tripErr } = await supabase
    .from("trips")
    .select("id, line_id, lines(name, mode)")
    .eq("id", record.trip_id)
    .single();
  if (tripErr || !trip) {
    return json({ error: "trip not found", detail: tripErr?.message }, 404);
  }
  const lineRel = Array.isArray(trip.lines) ? trip.lines[0] : trip.lines;
  const lineName: string = lineRel?.name ?? "Your line";
  const message = buildMessage(lineName, record.status, record.delay_minutes ?? 0);

  const { userIds, error } = await fanOutRecipients(supabase, trip.line_id);
  if (error) return json({ error: "recipient lookup failed", detail: error }, 500);

  return persistAndPush(
    supabase,
    userIds,
    { trip_id: record.trip_id, message },
    { title: lineName, body: message, data: { trip_id: record.trip_id } },
  );
}

async function handleServiceAlert(
  supabase: SupabaseClient,
  record: ServiceAlertRecord,
): Promise<Response> {
  const { data: line } = await supabase
    .from("lines")
    .select("name")
    .eq("id", record.line_id)
    .single();
  const lineName: string = line?.name ?? "Your line";
  const message = `${lineName}: ${record.title}`;

  const { userIds, error } = await fanOutRecipients(supabase, record.line_id);
  if (error) return json({ error: "recipient lookup failed", detail: error }, 500);

  return persistAndPush(
    supabase,
    userIds,
    { message },
    {
      title: `${lineName} — ${record.title}`,
      body: record.body,
      // No trip to deep-link to; the app routes line_id taps to the line.
      data: { line_id: record.line_id, alert_id: record.id },
    },
  );
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json().catch(() => null);
    // Accept both the webhook envelope and a bare record (handy for manual invokes).
    const record = payload?.record ?? payload;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (payload?.table === "service_alerts" || (record?.line_id && record?.title)) {
      if (!record?.line_id || !record?.title) {
        return json({ error: "missing record.line_id or record.title" }, 400);
      }
      return await handleServiceAlert(supabase, record as ServiceAlertRecord);
    }

    if (!record?.trip_id || !record?.status) {
      return json({ error: "missing record.trip_id or record.status" }, 400);
    }
    return await handleTripUpdate(supabase, record as TripUpdateRecord);
  } catch (err) {
    console.error("notify-trip-update fatal", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
