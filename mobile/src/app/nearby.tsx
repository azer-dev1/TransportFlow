import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ErrorText } from '@/components/ErrorText';
import { Spinner } from '@/components/Spinner';
import { StopsMap } from '@/components/StopsMap';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, spacing } from '@/lib/theme';

type NearbyStop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance_m: number;
  lines: { id: string; name: string }[];
};

function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

/**
 * Asks for foreground location, then feeds the coordinates to the
 * nearby_stops RPC (earthdistance, migration 7) and decorates each hit with
 * the lines serving it — same enrichment as the home-screen stop search.
 */
function useNearbyStops() {
  const [stops, setStops] = useState<NearbyStop[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'denied' | 'error' | 'ready'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    const { status: permission } = await Location.requestForegroundPermissionsAsync();
    if (permission !== 'granted') {
      setStatus('denied');
      return;
    }
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { data, error: rpcError } = await supabase.rpc('nearby_stops', {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        radius_m: 3000,
      });
      if (rpcError) throw new Error(rpcError.message);

      const hits: NearbyStop[] = (data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
        distance_m: s.distance_m,
        lines: [],
      }));
      if (hits.length) {
        const { data: serving } = await supabase
          .from('line_stops')
          .select('stop_id, lines(id, name)')
          .in('stop_id', hits.map((s) => s.id));
        for (const row of serving ?? []) {
          const stop = hits.find((s) => s.id === row.stop_id);
          if (stop && row.lines && !stop.lines.some((l) => l.id === row.lines!.id)) {
            stop.lines.push(row.lines);
          }
        }
      }
      setStops(hits);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { stops, status, error, reload: load };
}

export default function NearbyScreen() {
  const { stops, status, error, reload } = useNearbyStops();

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <Spinner />
        <Text style={styles.centerText}>Finding stops near you…</Text>
      </View>
    );
  }

  if (status === 'denied') {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>
          Location permission is needed to find nearby stops. Enable it in your device settings,
          then try again.
        </Text>
        <Button label="Try again" onPress={reload} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <ErrorText style={styles.centerError}>Couldn't load nearby stops: {error}</ErrorText>
        <Button label="Try again" onPress={reload} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {(stops?.length ?? 0) > 0 && (
        <View style={styles.mapWrap}>
          <StopsMap
            stops={(stops ?? []).map((s) => ({
              id: s.id,
              name: s.name,
              latitude: s.latitude,
              longitude: s.longitude,
              description: formatDistance(s.distance_m),
            }))}
            showsUserLocation
            height={260}
          />
        </View>
      )}
      <FlatList
        style={styles.listFlex}
        data={stops ?? []}
        keyExtractor={(stop) => stop.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.stopCard}>
            <View style={styles.stopHeader}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <Text style={styles.stopName}>{item.name}</Text>
              <Text style={styles.distance}>{formatDistance(item.distance_m)}</Text>
            </View>
            {item.lines.length > 0 && (
              <View style={styles.chips}>
                {item.lines.map((l) => (
                  <Link key={l.id} href={`/lines/${l.id}`} asChild>
                    <Chip label={l.name} />
                  </Link>
                ))}
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={<EmptyState>No stops within 3 km of your location.</EmptyState>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: spacing.lg,
    backgroundColor: colors.bg,
  },
  centerText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 21,
  },
  centerError: {
    textAlign: 'center',
  },
  mapWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  listFlex: {
    flex: 1,
  },
  // No gap: rows carry their own divider and must meet.
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  // Flattened from Card: a list item, not a distinct object.
  stopCard: {
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stopName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  distance: {
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
