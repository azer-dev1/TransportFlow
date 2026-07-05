import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ErrorText } from '@/components/ErrorText';
import { ModeIcon } from '@/components/ModeIcon';
import { Row } from '@/components/Row';
import { SectionTitle } from '@/components/SectionTitle';
import { Spinner } from '@/components/Spinner';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, radii, spacing } from '@/lib/theme';
import { useSupabaseQuery } from '@/lib/use-supabase-query';

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
    refetch,
    isRefreshing,
  } = useSupabaseQuery(() => supabase.from('lines').select('*').order('name'), []);
  const [query, setQuery] = useState('');
  const { results, searching } = useSearch(query);

  const lineRow = (line: { id: string; name: string; mode: string }) => (
    <Link href={`/lines/${line.id}`} asChild>
      <Row>
        <ModeIcon mode={line.mode} />
        <View style={styles.rowBody}>
          <Text style={styles.lineName}>{line.name}</Text>
          <Text style={styles.lineMode}>{line.mode}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Row>
    </Link>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search lines and stops…"
        placeholderTextColor={colors.textFaint}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

      <Link href="/nearby" asChild>
        <Row style={styles.nearbyButton}>
          <Ionicons name="locate-outline" size={18} color={colors.primary} />
          <Text style={styles.nearbyText}>Stops near me</Text>
        </Row>
      </Link>

      {isLoading && <Spinner style={styles.spinner} />}
      {error && <ErrorText style={styles.errorPadded}>Lines failed to load: {error}</ErrorText>}

      {results ? (
        <FlatList
          data={results.lines}
          keyExtractor={(line) => line.id}
          contentContainerStyle={styles.list}
          // keyboardShouldPersistTaps: with the keyboard open, the first tap must
          // open the tapped result instead of only dismissing the keyboard.
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            searching ? <Spinner style={styles.spinner} /> : (
              <SectionTitle>Lines</SectionTitle>
            )
          }
          renderItem={({ item }) => lineRow(item)}
          ListEmptyComponent={
            !searching && results.lines.length === 0 ? (
              <EmptyState>No matching lines.</EmptyState>
            ) : null
          }
          ListFooterComponent={
            results.stops.length > 0 ? (
              <View style={styles.stopsSection}>
                <SectionTitle>Stops</SectionTitle>
                {results.stops.map((stop) => (
                  <Card key={stop.id} style={styles.stopCard}>
                    <View style={styles.stopNameRow}>
                      <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                      <Text style={styles.stopName}>{stop.name}</Text>
                    </View>
                    {stop.lines.length > 0 && (
                      <View style={styles.chips}>
                        {stop.lines.map((l) => (
                          <Link key={l.id} href={`/lines/${l.id}`} asChild>
                            <Chip label={l.name} />
                          </Link>
                        ))}
                      </View>
                    )}
                  </Card>
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
          keyboardShouldPersistTaps="handled"
          onRefresh={refetch}
          refreshing={isRefreshing}
          renderItem={({ item }) => lineRow(item)}
          ListEmptyComponent={
            !isLoading && !error ? <EmptyState>No lines yet.</EmptyState> : null
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
  search: {
    margin: spacing.lg,
    marginBottom: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: fontSize.md,
  },
  nearbyButton: {
    marginHorizontal: spacing.lg,
    marginTop: 10,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  nearbyText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  spinner: {
    marginTop: spacing.lg,
  },
  errorPadded: {
    padding: spacing.lg,
  },
  list: {
    padding: spacing.lg,
    gap: 10,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  lineName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  lineMode: {
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  stopsSection: {
    gap: 10,
    marginTop: 6,
  },
  stopCard: {
    gap: 10,
  },
  stopNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stopName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
