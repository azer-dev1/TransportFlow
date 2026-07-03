import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { StaffReportCard } from '@/components/StaffReportCard';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
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
    () =>
      supabase
        .from('trips')
        .select('*, lines(name, mode, line_stops(id, sequence_order, arrival_offset_minutes, stops(name)))')
        .eq('id', id)
        .single(),
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
        () => refetchTrip(),
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
  }, [id, refetchTrip, refetchHistory]);

  const stops = [...(trip?.lines?.line_stops ?? [])].sort(
    (a, b) => a.sequence_order - b.sequence_order,
  );
  const departure = trip ? new Date(trip.scheduled_departure) : null;
  const delayMs = trip?.status === 'delayed' ? trip.delay_minutes * 60_000 : 0;
  const cancelled = trip?.status === 'cancelled';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: trip?.lines?.name ?? 'Trip' }} />

      {tripLoading && <ActivityIndicator style={styles.spinner} />}
      {tripError && <Text style={styles.error}>Trip failed to load: {tripError}</Text>}

      {trip && departure && (
        <FlatList
          data={history ?? []}
          keyExtractor={(update) => update.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <View style={styles.card}>
                <Text style={styles.departure}>{formatWhen(trip.scheduled_departure)}</Text>
                <StatusBadge status={trip.status} delayMinutes={trip.delay_minutes} />
              </View>

              <StaffReportCard tripId={trip.id} />

              <Text style={styles.sectionTitle}>Stops</Text>
              <View style={styles.card}>
                {stops.map((ls, index) => {
                  const eta = new Date(
                    departure.getTime() + ls.arrival_offset_minutes * 60_000 + delayMs,
                  );
                  return (
                    <View key={ls.id} style={styles.stopRow}>
                      <View style={styles.stopMarkerColumn}>
                        <View style={[styles.stopDot, cancelled && styles.stopDotCancelled]} />
                        {index < stops.length - 1 && <View style={styles.stopLine} />}
                      </View>
                      <Text style={[styles.stopName, cancelled && styles.cancelledText]}>
                        {ls.stops?.name ?? 'Unknown stop'}
                      </Text>
                      <Text style={[styles.stopEta, cancelled && styles.cancelledText]}>
                        {formatTime(eta)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>Updates</Text>
              {historyError && (
                <Text style={styles.error}>Updates failed to load: {historyError}</Text>
              )}
            </View>
          }
          renderItem={({ item: update }) => (
            <View style={styles.updateRow}>
              <View style={styles.updateBody}>
                <StatusBadge status={update.status} delayMinutes={update.delay_minutes} />
                <Text style={styles.updateMeta}>
                  {update.profiles?.full_name ?? 'Staff'} · {formatWhen(update.created_at)}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            !historyError ? <Text style={styles.empty}>No updates reported for this trip.</Text> : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  spinner: {
    marginTop: 32,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  headerBlock: {
    gap: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eaecf0',
    padding: 16,
    gap: 8,
  },
  departure: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stopMarkerColumn: {
    alignItems: 'center',
    width: 12,
  },
  stopDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#175cd3',
    marginTop: 5,
  },
  stopDotCancelled: {
    backgroundColor: '#98a2b3',
  },
  stopLine: {
    width: 2,
    flex: 1,
    minHeight: 18,
    backgroundColor: '#d0d5dd',
  },
  stopName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingBottom: 16,
  },
  stopEta: {
    color: '#475467',
    fontVariant: ['tabular-nums'],
  },
  cancelledText: {
    color: '#98a2b3',
    textDecorationLine: 'line-through',
  },
  error: {
    color: '#d92d20',
    padding: 16,
  },
  updateRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eaecf0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  updateBody: {
    gap: 6,
  },
  updateMeta: {
    color: '#475467',
    fontSize: 13,
  },
  empty: {
    textAlign: 'center',
    color: '#98a2b3',
    marginTop: 8,
  },
});
