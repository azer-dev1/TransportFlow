// notify-trip-update
//
// Invoked by the database webhook on `trip_updates` INSERT (see migration
// 00000000000003). Fans a trip disruption out to every rider who favorited the
// affected line — or a stop that line serves — by persisting a `notifications`
// row and sending an Expo push. Runs with the service_role key (RLS-bypassing),
// which the DB webhook passes as a Bearer token and which is also injected into
// the runtime as SUPABASE_SERVICE_ROLE_KEY.
//
// Payload shape (Supabase DB webhook): { type, table, schema, record }.

import { createClient } from "jsr:@supabase/supabase-js@2";

interface TripUpdateRecord {
  id?: string;
  trip_id: string;
  reporter_id?: string;
  status: "on_time" | "delayed" | "cancelled";
  delay_minutes?: number;
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
  tripId: string,
): Promise<{ sent: number; staleTokens: string[] }> {
  // Expo tokens look like ExponentPushToken[xxxxxxxx]; skip anything else.
  const messages = tokens
    .filter((t) => typeof t === "string" && t.startsWith("ExponentPushToken"))
    .map((to) => ({ to, sound: "default", title, body, data: { trip_id: tripId } }));
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

Deno.serve(async (req) => {
  try {
    const payload = await req.json().catch(() => null);
    // Accept both the webhook envelope and a bare record (handy for manual invokes).
    const record: TripUpdateRecord | undefined = payload?.record ?? payload;
    if (!record?.trip_id || !record?.status) {
      return json({ error: "missing record.trip_id or record.status" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    // Recipients: favorites on the line, or on any stop the line serves.
    const { data: lineStops } = await supabase
      .from("line_stops")
      .select("stop_id")
      .eq("line_id", trip.line_id);
    const stopIds = (lineStops ?? []).map((r) => r.stop_id);

    let favQuery = supabase.from("favorites").select("user_id");
    favQuery = stopIds.length
      ? favQuery.or(`line_id.eq.${trip.line_id},stop_id.in.(${stopIds.join(",")})`)
      : favQuery.eq("line_id", trip.line_id);
    const { data: favs, error: favErr } = await favQuery;
    if (favErr) {
      return json({ error: "recipient lookup failed", detail: favErr.message }, 500);
    }

    const userIds = [...new Set((favs ?? []).map((f) => f.user_id))];
    if (userIds.length === 0) {
      return json({ recipients: 0, notifications: 0, devices: 0, push_sent: 0 });
    }

    // Persist notifications (the durable record, readable by each owner via RLS).
    const rows = userIds.map((uid) => ({
      user_id: uid,
      trip_id: record.trip_id,
      message,
    }));
    const { error: notifErr } = await supabase.from("notifications").insert(rows);
    if (notifErr) {
      return json({ error: "notification insert failed", detail: notifErr.message }, 500);
    }

    // Best-effort Expo push to those users' registered devices.
    const { data: devices } = await supabase
      .from("devices")
      .select("expo_push_token")
      .in("user_id", userIds);
    const tokens = [...new Set((devices ?? []).map((d) => d.expo_push_token))];
    const { sent: pushSent, staleTokens } = await sendExpoPush(
      tokens,
      lineName,
      message,
      record.trip_id,
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
      devices: tokens.length,
      push_sent: pushSent,
      stale_devices_pruned: staleTokens.length,
    });
  } catch (err) {
    console.error("notify-trip-update fatal", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
