import * as Location from 'expo-location';
import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

type NearbyStop = {
  id: string;
  name: string;
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
        <ActivityIndicator />
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
        <Pressable style={styles.retry} onPress={reload}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Couldn't load nearby stops: {error}</Text>
        <Pressable style={styles.retry} onPress={reload}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={stops ?? []}
      keyExtractor={(stop) => stop.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.stopCard}>
          <View style={styles.stopHeader}>
            <Text style={styles.stopName}>🚏 {item.name}</Text>
            <Text style={styles.distance}>{formatDistance(item.distance_m)}</Text>
          </View>
          {item.lines.length > 0 && (
            <View style={styles.chips}>
              {item.lines.map((l) => (
                <Link key={l.id} href={`/lines/${l.id}`} asChild>
                  <Pressable style={styles.chip}>
                    <Text style={styles.chipText}>{l.name}</Text>
                  </Pressable>
                </Link>
              ))}
            </View>
          )}
        </View>
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>No stops within 3 km of your location.</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
    backgroundColor: '#f8fafc',
  },
  centerText: {
    textAlign: 'center',
    color: '#475467',
    fontSize: 15,
    lineHeight: 21,
  },
  error: {
    textAlign: 'center',
    color: '#d92d20',
  },
  retry: {
    backgroundColor: '#175cd3',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  stopCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eaecf0',
    padding: 16,
    gap: 10,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stopName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  distance: {
    color: '#475467',
    fontVariant: ['tabular-nums'],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#eff8ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {
    color: '#175cd3',
    fontWeight: '600',
    fontSize: 13,
  },
  empty: {
    textAlign: 'center',
    color: '#98a2b3',
    marginTop: 32,
  },
});
