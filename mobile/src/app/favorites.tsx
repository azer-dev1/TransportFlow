import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Star } from '@/components/Star';
import { useFavorites } from '@/lib/use-favorites';

const MODE_ICONS: Record<string, string> = { bus: '🚌', train: '🚆' };

export default function FavoritesScreen() {
  const { favorites, error, isLoading, mutationError, toggleLine, toggleStop } = useFavorites();

  const lines = favorites.filter((f) => f.lines);
  const stops = favorites.filter((f) => f.stops);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {isLoading && <ActivityIndicator style={styles.spinner} />}
      {error && <Text style={styles.error}>Favorites failed to load: {error}</Text>}
      {mutationError && <Text style={styles.error}>Change failed: {mutationError}</Text>}

      {!isLoading && favorites.length === 0 && !error && (
        <Text style={styles.empty}>
          Nothing here yet. Star a line or a stop to get updates that matter to you.
        </Text>
      )}

      {lines.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Lines</Text>
          {lines.map((favorite) => (
            <Link key={favorite.id} href={`/lines/${favorite.lines!.id}`} asChild>
              <Pressable style={styles.row}>
                <Text style={styles.modeIcon}>{MODE_ICONS[favorite.lines!.mode] ?? '🚏'}</Text>
                <Text style={styles.rowName}>{favorite.lines!.name}</Text>
                <Star active onPress={() => toggleLine(favorite.lines!.id)} />
              </Pressable>
            </Link>
          ))}
        </>
      )}

      {stops.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Stops</Text>
          {stops.map((favorite) => (
            <View key={favorite.id} style={styles.row}>
              <Text style={styles.modeIcon}>🚏</Text>
              <Text style={styles.rowName}>{favorite.stops!.name}</Text>
              <Star active onPress={() => toggleStop(favorite.stops!.id)} />
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    gap: 10,
  },
  spinner: {
    marginTop: 32,
  },
  error: {
    color: '#d92d20',
  },
  empty: {
    textAlign: 'center',
    color: '#98a2b3',
    marginTop: 48,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
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
    fontSize: 22,
  },
  rowName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
});
