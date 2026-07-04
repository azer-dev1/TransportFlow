import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { AlertBanner } from '@/components/AlertBanner';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorText } from '@/components/ErrorText';
import { Row } from '@/components/Row';
import { SectionTitle } from '@/components/SectionTitle';
import { StaffAlertCard } from '@/components/StaffAlertCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Star } from '@/components/Star';
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
  const { isLineFavorite, isStopFavorite, toggleLine, toggleStop, mutationError } = useFavorites();

  const { data: line, refetch: refetchLine } = useSupabaseQuery(
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

  const { data: lineStops, error: stopsError, refetch: refetchStops } = useSupabaseQuery(
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
    refetch: refetchTrips,
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
        refreshing={tripsRefreshing}
        onRefresh={() => {
          refetchLine();
          refetchAlerts();
          refetchStops();
          refetchTrips();
        }}
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

            <SectionTitle style={styles.sectionTitle}>Stops</SectionTitle>
            {stopsError && <ErrorText>Stops failed to load: {stopsError}</ErrorText>}
            {mutationError && <ErrorText>Favorite change failed: {mutationError}</ErrorText>}
            <Card style={styles.stopsCard}>
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
            </Card>

            <SectionTitle style={styles.sectionTitle}>Upcoming departures</SectionTitle>
            {tripsLoading && <ActivityIndicator style={styles.spinner} />}
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
  list: {
    padding: spacing.lg,
    gap: 10,
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
