import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorText } from '@/components/ErrorText';
import { SectionTitle } from '@/components/SectionTitle';
import { StaffReportCard } from '@/components/StaffReportCard';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, spacing } from '@/lib/theme';
import { useSupabaseQuery } from '@/lib/use-supabase-query';

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}, ${formatTime(d)}`;
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    data: trip,
    error: tripError,
    isLoading: tripLoading,
    refetch: refetchTrip,
  } = useSupabaseQuery(
    () => supabase.from('trips').select('*, lines(name, mode)').eq('id', id).single(),
    [id],
  );

  // Server-side ETAs: the trip_stop_times view owns the arrival math
  // (offset + delay, NULL expected_arrival when cancelled).
  const {
    data: stopTimes,
    refetch: refetchStopTimes,
    isRefreshing: stopTimesRefreshing,
  } = useSupabaseQuery(
    () =>
      supabase
        .from('trip_stop_times')
        .select('*')
        .eq('trip_id', id)
        .order('sequence_order'),
    [id],
  );

  const {
    data: history,
    error: historyError,
    refetch: refetchHistory,
  } = useSupabaseQuery(
    () =>
      supabase
        .from('trip_updates')
        .select('*, profiles(full_name)')
        .eq('trip_id', id)
        .order('created_at', { ascending: false }),
    [id],
  );

  // Live loop: staff INSERTs a trip_update -> apply_trip_update() UPDATEs
  // trips -> both events stream here and the screen refetches.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`trip-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${id}` },
        () => {
          refetchTrip();
          refetchStopTimes(); // delay changes shift every ETA
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_updates', filter: `trip_id=eq.${id}` },
        () => refetchHistory(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, refetchTrip, refetchStopTimes, refetchHistory]);

  const cancelled = trip?.status === 'cancelled';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: trip?.lines?.name ?? 'Trip' }} />

      {tripLoading && <ActivityIndicator style={styles.spinner} />}
      {tripError && <ErrorText style={styles.errorPadded}>Trip failed to load: {tripError}</ErrorText>}

      {trip && (
        <FlatList
          data={history ?? []}
          keyExtractor={(update) => update.id}
          contentContainerStyle={styles.list}
          refreshing={stopTimesRefreshing}
          onRefresh={() => {
            refetchTrip();
            refetchStopTimes();
            refetchHistory();
          }}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <Card>
                <Text style={styles.departure}>{formatWhen(trip.scheduled_departure)}</Text>
                <StatusBadge status={trip.status} delayMinutes={trip.delay_minutes} />
              </Card>

              <StaffReportCard tripId={trip.id} />

              <SectionTitle style={styles.sectionTitle}>Stops</SectionTitle>
              <Card style={styles.stopsCard}>
                {(stopTimes ?? []).map((st, index) => {
                  // Cancelled trips have no expected arrival; show the
                  // scheduled time (struck through via cancelledText).
                  const etaIso = st.expected_arrival ?? st.scheduled_arrival;
                  return (
                    <View key={st.line_stop_id ?? index} style={styles.stopRow}>
                      <View style={styles.stopMarkerColumn}>
                        <View style={[styles.stopDot, cancelled && styles.stopDotCancelled]} />
                        {index < (stopTimes?.length ?? 0) - 1 && <View style={styles.stopLine} />}
                      </View>
                      <Text style={[styles.stopName, cancelled && styles.cancelledText]}>
                        {st.stop_name ?? 'Unknown stop'}
                      </Text>
                      <Text style={[styles.stopEta, cancelled && styles.cancelledText]}>
                        {etaIso ? formatTime(new Date(etaIso)) : '—'}
                      </Text>
                    </View>
                  );
                })}
              </Card>

              <SectionTitle style={styles.sectionTitle}>Updates</SectionTitle>
              {historyError && <ErrorText>Updates failed to load: {historyError}</ErrorText>}
            </View>
          }
          renderItem={({ item: update }) => (
            <Card style={styles.updateRow}>
              <StatusBadge status={update.status} delayMinutes={update.delay_minutes} />
              <Text style={styles.updateMeta}>
                {update.profiles?.full_name ?? 'Staff'} · {formatWhen(update.created_at)}
              </Text>
            </Card>
          )}
          ListEmptyComponent={
            !historyError ? <EmptyState>No updates reported for this trip.</EmptyState> : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  spinner: {
    marginTop: 32,
  },
  errorPadded: {
    padding: spacing.lg,
  },
  list: {
    padding: spacing.lg,
    gap: 10,
  },
  headerBlock: {
    gap: 10,
  },
  departure: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
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
  stopDotCancelled: {
    backgroundColor: colors.textFaint,
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
  stopEta: {
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  cancelledText: {
    color: colors.textFaint,
    textDecorationLine: 'line-through',
  },
  updateRow: {
    paddingVertical: spacing.md,
    gap: 6,
  },
  updateMeta: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
});
