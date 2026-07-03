import { Link, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/use-supabase-query';

const MODE_ICONS: Record<string, string> = { bus: '🚌', train: '🚆' };

export default function LinesScreen() {
  const {
    data: lines,
    error,
    isLoading,
  } = useSupabaseQuery(() => supabase.from('lines').select('*').order('name'), []);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Lines',
          headerRight: () => (
            <Link href="/profile" style={styles.headerLink}>
              Profile
            </Link>
          ),
        }}
      />

      {isLoading && <ActivityIndicator style={styles.spinner} />}
      {error && <Text style={styles.error}>Lines failed to load: {error}</Text>}

      <FlatList
        data={lines ?? []}
        keyExtractor={(line) => line.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: line }) => (
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
        )}
        ListEmptyComponent={
          !isLoading && !error ? <Text style={styles.empty}>No lines yet.</Text> : null
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
  headerLink: {
    color: '#175cd3',
    fontSize: 16,
    fontWeight: '600',
  },
  spinner: {
    marginTop: 32,
  },
  error: {
    color: '#d92d20',
    padding: 16,
  },
  list: {
    padding: 16,
    gap: 10,
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
  empty: {
    textAlign: 'center',
    color: '#98a2b3',
    marginTop: 32,
  },
});
