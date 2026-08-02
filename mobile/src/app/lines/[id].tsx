import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { AlertBanner } from '@/components/AlertBanner';
import { EmptyState } from '@/components/EmptyState';
import { ErrorText } from '@/components/ErrorText';
import { Row } from '@/components/Row';
import { SectionTitle } from '@/components/SectionTitle';
import { Spinner } from '@/components/Spinner';
import { StaffAlertCard } from '@/components/StaffAlertCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Star } from '@/components/Star';
import { StopsMap } from '@/components/StopsMap';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, spacing } from '@/lib/theme';
import { useFavorites } from '@/lib/use-favorites';
import { useSupabaseQuery } from '@/lib/use-supabase-query';

function departureDayLabel(iso: string): string {
  const departure = new Date(iso);
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(departure) - startOfDay(today)) / 86_400_000);
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tomorrow';
  return departure.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function departureTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function LineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { isLineFavorite, isStopFavorite, toggleLine, toggleStop, mutationError } = useFavorites();
  const isStaff = profile?.role === 'staff' || profile?.role === 'admin';
  // id of the alert whose end/delete request is in flight, if any
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);
  const [alertActionError, setAlertActionError] = useState<string | null>(null);

  const { data: line } = useSupabaseQuery(
    () => supabase.from('lines').select('*').eq('id', id).single(),
    [id],
  );

  // Active service alerts: started, and not yet ended (or open-ended).
  const { data: alerts, refetch: refetchAlerts } = useSupabaseQuery(
    () =>
      supabase
        .from('service_alerts')
        .select('*')
        .eq('line_id', id)
        .lte('starts_at', new Date().toISOString())
        .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
        .order('starts_at', { ascending: false }),
    [id],
  );

  const { data: lineStops, error: stopsError } = useSupabaseQuery(
    () =>
      supabase
        .from('line_stops')
        .select('id, sequence_order, arrival_offset_minutes, stops(id, name, latitude, longitude)')
        .eq('line_id', id)
        .order('sequence_order'),
    [id],
  );

  const {
    data: trips,
    error: tripsError,
    isLoading: tripsLoading,
    isRefreshing: tripsRefreshing,
  } = useSupabaseQuery(
    () =>
      supabase
        .from('trips')
        .select('*')
        .eq('line_id', id)
        .gte('scheduled_departure', new Date().toISOString())
        .order('scheduled_departure')
        .limit(15),
    [id],
  );

  // "End now" keeps the row as history and just closes its window; "Delete"
  // retracts it outright (RLS lets staff/admin do either — migration 11).
  // Riders already notified keep their notifications row either way.
  async function endAlert(alertId: string) {
    setPendingAlertId(alertId);
    setAlertActionError(null);
    const { error } = await supabase
      .from('service_alerts')
      .update({ ends_at: new Date().toISOString() })
      .eq('id', alertId);
    setPendingAlertId(null);
    if (error) setAlertActionError(error.message);
    else refetchAlerts();
  }

  function confirmDeleteAlert(alertId: string, alertTitle: string) {
    Alert.alert('Delete alert?', `"${alertTitle}" will be removed for all riders.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setPendingAlertId(alertId);
          setAlertActionError(null);
          const { error } = await supabase.from('service_alerts').delete().eq('id', alertId);
          setPendingAlertId(null);
          if (error) setAlertActionError(error.message);
          else refetchAlerts();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: line?.name ?? 'Line',
          headerRight: () => <Star active={isLineFavorite(id)} onPress={() => toggleLine(id)} />,
        }}
      />

      <FlatList
        data={trips ?? []}
        keyExtractor={(trip) => trip.id}
        contentContainerStyle={styles.list}
        // keyboardShouldPersistTaps: with the keyboard open, the first tap must
        // reach Post alert instead of only dismissing the keyboard.
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Shown while an alert action refetches; there is no
                pull-to-refresh on this screen. */}
            {tripsRefreshing && <Spinner style={styles.spinner} />}

            {(alerts ?? []).map((alert) => (
              <AlertBanner
                key={alert.id}
                title={alert.title}
                body={alert.body}
                severity={alert.severity}
                busy={pendingAlertId === alert.id}
                onEnd={isStaff ? () => endAlert(alert.id) : undefined}
                onDelete={isStaff ? () => confirmDeleteAlert(alert.id, alert.title) : undefined}
              />
            ))}
            {alertActionError && <ErrorText>Alert change failed: {alertActionError}</ErrorText>}

            <StaffAlertCard lineId={id} onPosted={refetchAlerts} />

            <StopsMap
              connected
              stops={(lineStops ?? [])
                .filter((ls) => ls.stops)
                .map((ls) => ({
                  // line_stops row id, not the stop id: a loop route (e.g.
                  // "CNR-ESSAIED-CNR") visits the same stop twice, and keying
                  // markers by stop id gives React duplicate keys.
                  id: ls.id,
                  name: ls.stops!.name,
                  latitude: ls.stops!.latitude,
                  longitude: ls.stops!.longitude,
                  description:
                    ls.arrival_offset_minutes === 0
                      ? 'Departure'
                      : `+${ls.arrival_offset_minutes} min`,
                }))}
            />

            <SectionTitle style={styles.sectionTitle}>Stops</SectionTitle>
            {stopsError && <ErrorText>Stops failed to load: {stopsError}</ErrorText>}
            {mutationError && <ErrorText>Favorite change failed: {mutationError}</ErrorText>}
            <View style={styles.stopsCard}>
              {(lineStops ?? []).map((ls, index) => (
                <View key={ls.id} style={styles.stopRow}>
                  <View style={styles.stopMarkerColumn}>
                    <View style={styles.stopDot} />
                    {index < (lineStops?.length ?? 0) - 1 && <View style={styles.stopLine} />}
                  </View>
                  <Text style={styles.stopName}>{ls.stops?.name ?? 'Unknown stop'}</Text>
                  <Text style={styles.stopOffset}>
                    {ls.arrival_offset_minutes === 0 ? 'Departure' : `+${ls.arrival_offset_minutes} min`}
                  </Text>
                  {ls.stops && (
                    <Star
                      size={18}
                      active={isStopFavorite(ls.stops.id)}
                      onPress={() => toggleStop(ls.stops!.id)}
                    />
                  )}
                </View>
              ))}
            </View>

            <SectionTitle style={styles.sectionTitle}>Upcoming departures</SectionTitle>
            {tripsLoading && <Spinner style={styles.spinner} />}
            {tripsError && <ErrorText>Schedule failed to load: {tripsError}</ErrorText>}
          </View>
        }
        renderItem={({ item: trip }) => (
          <Link href={`/trips/${trip.id}`} asChild>
            <Row style={styles.tripRow}>
              <View style={styles.tripWhen}>
                <Text style={styles.tripTime}>{departureTime(trip.scheduled_departure)}</Text>
                <Text style={styles.tripDay}>{departureDayLabel(trip.scheduled_departure)}</Text>
              </View>
              <StatusBadge status={trip.status} delayMinutes={trip.delay_minutes} />
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Row>
          </Link>
        )}
        ListEmptyComponent={
          !tripsLoading && !tripsError ? (
            <EmptyState>No upcoming departures.</EmptyState>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // No gap: rows carry their own divider and must meet.
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  header: {
    gap: 10,
  },
  sectionTitle: {
    marginTop: spacing.sm,
  },
  stopsCard: {
    gap: 0,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stopMarkerColumn: {
    alignItems: 'center',
    width: 12,
  },
  stopDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  stopLine: {
    width: 2,
    flex: 1,
    minHeight: 18,
    backgroundColor: colors.borderStrong,
  },
  stopName: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text,
    paddingBottom: spacing.lg,
  },
  stopOffset: {
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  spinner: {
    marginVertical: spacing.sm,
  },
  tripRow: {
    paddingVertical: spacing.md,
  },
  tripWhen: {
    flex: 1,
    gap: 2,
  },
  tripTime: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  tripDay: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
});
