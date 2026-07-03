import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AlertBanner } from '@/components/AlertBanner';
import { StaffAlertCard } from '@/components/StaffAlertCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Star } from '@/components/Star';
import { supabase } from '@/lib/supabase';
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
  const { isLineFavorite, isStopFavorite, toggleLine, toggleStop, mutationError } = useFavorites();

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
        .select('id, sequence_order, arrival_offset_minutes, stops(id, name)')
        .eq('line_id', id)
        .order('sequence_order'),
    [id],
  );

  const {
    data: trips,
    error: tripsError,
    isLoading: tripsLoading,
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
        ListHeaderComponent={
          <View style={styles.header}>
            {(alerts ?? []).map((alert) => (
              <AlertBanner
                key={alert.id}
                title={alert.title}
                body={alert.body}
                severity={alert.severity}
              />
            ))}

            <StaffAlertCard lineId={id} onPosted={refetchAlerts} />

            <Text style={styles.sectionTitle}>Stops</Text>
            {stopsError && <Text style={styles.error}>Stops failed to load: {stopsError}</Text>}
            {mutationError && <Text style={styles.error}>Favorite change failed: {mutationError}</Text>}
            <View style={styles.card}>
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

            <Text style={styles.sectionTitle}>Upcoming departures</Text>
            {tripsLoading && <ActivityIndicator style={styles.spinner} />}
            {tripsError && <Text style={styles.error}>Schedule failed to load: {tripsError}</Text>}
          </View>
        }
        renderItem={({ item: trip }) => (
          <Link href={`/trips/${trip.id}`} asChild>
            <Pressable style={styles.tripRow}>
              <View style={styles.tripWhen}>
                <Text style={styles.tripTime}>{departureTime(trip.scheduled_departure)}</Text>
                <Text style={styles.tripDay}>{departureDayLabel(trip.scheduled_departure)}</Text>
              </View>
              <StatusBadge status={trip.status} delayMinutes={trip.delay_minutes} />
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </Link>
        )}
        ListEmptyComponent={
          !tripsLoading && !tripsError ? (
            <Text style={styles.empty}>No upcoming departures.</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  list: {
    padding: 16,
    gap: 10,
  },
  header: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eaecf0',
    padding: 16,
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
  stopOffset: {
    color: '#475467',
    fontVariant: ['tabular-nums'],
  },
  spinner: {
    marginVertical: 8,
  },
  error: {
    color: '#d92d20',
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eaecf0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tripWhen: {
    flex: 1,
    gap: 2,
  },
  chevron: {
    fontSize: 24,
    color: '#98a2b3',
  },
  tripTime: {
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  tripDay: {
    color: '#475467',
    fontSize: 13,
  },
  empty: {
    textAlign: 'center',
    color: '#98a2b3',
    marginTop: 8,
  },
});
