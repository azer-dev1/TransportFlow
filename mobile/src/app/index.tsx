import { Link, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/use-supabase-query';
import { useUnreadCount } from '@/lib/use-unread-count';

const MODE_ICONS: Record<string, string> = { bus: '🚌', train: '🚆' };

type LineHit = { id: string; name: string; mode: string };
type StopHit = {
  id: string;
  name: string;
  lines: { id: string; name: string }[];
};

/**
 * Typo-tolerant search over the search_lines / search_stops RPCs (pg_trgm).
 * Stop hits are decorated with the lines serving them so a stop result is
 * tappable through to a line screen.
 */
function useSearch(query: string) {
  const [results, setResults] = useState<{ lines: LineHit[]; stops: StopHit[] } | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const [lineRes, stopRes] = await Promise.all([
        supabase.rpc('search_lines', { query: q, max_results: 8 }),
        supabase.rpc('search_stops', { query: q, max_results: 8 }),
      ]);
      const lineHits = (lineRes.data ?? []) as LineHit[];
      const stopHits = (stopRes.data ?? []).map((s) => ({ id: s.id, name: s.name, lines: [] as StopHit['lines'] }));

      if (stopHits.length) {
        const { data: serving } = await supabase
          .from('line_stops')
          .select('stop_id, lines(id, name)')
          .in('stop_id', stopHits.map((s) => s.id));
        for (const row of serving ?? []) {
          const stop = stopHits.find((s) => s.id === row.stop_id);
          if (stop && row.lines && !stop.lines.some((l) => l.id === row.lines!.id)) {
            stop.lines.push(row.lines);
          }
        }
      }
      if (!cancelled) {
        setResults({ lines: lineHits, stops: stopHits });
        setSearching(false);
      }
    }, 250); // debounce keystrokes
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { results, searching };
}

export default function LinesScreen() {
  const {
    data: lines,
    error,
    isLoading,
  } = useSupabaseQuery(() => supabase.from('lines').select('*').order('name'), []);
  const [query, setQuery] = useState('');
  const { results, searching } = useSearch(query);
  const unread = useUnreadCount();

  const lineRow = (line: { id: string; name: string; mode: string }) => (
    <Link href={`/lines/${line.id}`} asChild>
      <Pressable style={styles.row}>
        <Text style={styles.modeIcon}>{MODE_ICONS[line.mode] ?? '🚏'}</Text>
        <View style={styles.rowBody}>
          <Text style={styles.lineName}>{line.name}</Text>
          <Text style={styles.lineMode}>{line.mode}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Link>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Lines',
          headerRight: () => (
            <View style={styles.headerLinks}>
              <Link href="/notifications" style={styles.headerLink}>
                <View style={styles.bellWrap}>
                  <Text style={styles.headerLink}>🔔</Text>
                  {unread > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                    </View>
                  )}
                </View>
              </Link>
              <Link href="/favorites" style={styles.headerLink}>
                ★
              </Link>
              <Link href="/profile" style={styles.headerLink}>
                Profile
              </Link>
            </View>
          ),
        }}
      />

      <TextInput
        style={styles.search}
        placeholder="Search lines and stops…"
        placeholderTextColor="#98a2b3"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

      {isLoading && <ActivityIndicator style={styles.spinner} />}
      {error && <Text style={styles.error}>Lines failed to load: {error}</Text>}

      {results ? (
        <FlatList
          data={results.lines}
          keyExtractor={(line) => line.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            searching ? <ActivityIndicator style={styles.spinner} /> : (
              <Text style={styles.sectionTitle}>Lines</Text>
            )
          }
          renderItem={({ item }) => lineRow(item)}
          ListEmptyComponent={
            !searching && results.lines.length === 0 ? (
              <Text style={styles.empty}>No matching lines.</Text>
            ) : null
          }
          ListFooterComponent={
            results.stops.length > 0 ? (
              <View style={styles.stopsSection}>
                <Text style={styles.sectionTitle}>Stops</Text>
                {results.stops.map((stop) => (
                  <View key={stop.id} style={styles.stopCard}>
                    <Text style={styles.stopName}>🚏 {stop.name}</Text>
                    {stop.lines.length > 0 && (
                      <View style={styles.chips}>
                        {stop.lines.map((l) => (
                          <Link key={l.id} href={`/lines/${l.id}`} asChild>
                            <Pressable style={styles.chip}>
                              <Text style={styles.chipText}>{l.name}</Text>
                            </Pressable>
                          </Link>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : null
          }
        />
      ) : (
        <FlatList
          data={lines ?? []}
          keyExtractor={(line) => line.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => lineRow(item)}
          ListEmptyComponent={
            !isLoading && !error ? <Text style={styles.empty}>No lines yet.</Text> : null
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
  headerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerLink: {
    color: '#175cd3',
    fontSize: 16,
    fontWeight: '600',
  },
  bellWrap: {
    flexDirection: 'row',
  },
  badge: {
    backgroundColor: '#d92d20',
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
    marginTop: -4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  search: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  spinner: {
    marginTop: 16,
  },
  error: {
    color: '#d92d20',
    padding: 16,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eaecf0',
    padding: 16,
  },
  modeIcon: {
    fontSize: 24,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  lineName: {
    fontSize: 16,
    fontWeight: '600',
  },
  lineMode: {
    color: '#475467',
    textTransform: 'capitalize',
  },
  chevron: {
    fontSize: 24,
    color: '#98a2b3',
  },
  stopsSection: {
    gap: 10,
    marginTop: 6,
  },
  stopCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eaecf0',
    padding: 16,
    gap: 10,
  },
  stopName: {
    fontSize: 15,
    fontWeight: '600',
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
