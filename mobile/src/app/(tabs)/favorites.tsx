import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { ErrorText } from '@/components/ErrorText';
import { ModeIcon } from '@/components/ModeIcon';
import { Row, RowView } from '@/components/Row';
import { SectionTitle } from '@/components/SectionTitle';
import { Spinner } from '@/components/Spinner';
import { Star } from '@/components/Star';
import { colors, fontSize, spacing } from '@/lib/theme';
import { useFavorites } from '@/lib/use-favorites';

/** Bell toggle: muted favorites stay starred but never notify. */
function MuteBell({ muted, onPress }: { muted: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={muted ? 'Unmute notifications' : 'Mute notifications'}
    >
      <Ionicons
        name={muted ? 'notifications-off-outline' : 'notifications-outline'}
        size={20}
        color={muted ? colors.textFaint : colors.textBody}
      />
    </Pressable>
  );
}

export default function FavoritesScreen() {
  const {
    favorites,
    error,
    isLoading,
    refetch,
    isRefreshing,
    mutationError,
    isLineFavorite,
    isStopFavorite,
    toggleLine,
    toggleStop,
    setMuted,
  } = useFavorites();

  // The tab stays mounted, so re-sync whenever it regains focus — stars can
  // be toggled from the line screen in between. First focus is covered by
  // the mount fetch.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refetch();
    }, [refetch]),
  );

  const lines = favorites.filter((f) => f.lines);
  const stops = favorites.filter((f) => f.stops);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {(isLoading || isRefreshing) && <Spinner style={styles.spinner} />}
      {error && <ErrorText>Favorites failed to load: {error}</ErrorText>}
      {mutationError && <ErrorText>Change failed: {mutationError}</ErrorText>}

      {!isLoading && favorites.length === 0 && !error && (
        <EmptyState>
          Nothing here yet. Star a line or a stop to get updates that matter to you.
        </EmptyState>
      )}

      {lines.length > 0 && (
        <>
          <SectionTitle style={styles.sectionTitle}>Lines</SectionTitle>
          {lines.map((favorite) => (
            <Link key={favorite.id} href={`/lines/${favorite.lines!.id}`} asChild>
              <Row>
                <ModeIcon mode={favorite.lines!.mode} />
                <Text style={styles.rowName}>{favorite.lines!.name}</Text>
                <MuteBell
                  muted={favorite.muted}
                  onPress={() => setMuted(favorite.id, !favorite.muted)}
                />
                <Star
                  active={isLineFavorite(favorite.lines!.id)}
                  onPress={() => toggleLine(favorite.lines!.id)}
                />
              </Row>
            </Link>
          ))}
        </>
      )}

      {stops.length > 0 && (
        <>
          <SectionTitle style={styles.sectionTitle}>Stops</SectionTitle>
          {stops.map((favorite) => (
            <RowView key={favorite.id}>
              <Ionicons name="location-outline" size={20} color={colors.primary} />
              <Text style={styles.rowName}>{favorite.stops!.name}</Text>
              <MuteBell
                muted={favorite.muted}
                onPress={() => setMuted(favorite.id, !favorite.muted)}
              />
              <Star
                active={isStopFavorite(favorite.stops!.id)}
                onPress={() => toggleStop(favorite.stops!.id)}
              />
            </RowView>
          ))}
        </>
      )}

      {favorites.some((f) => f.muted) && (
        <Text style={styles.mutedHint}>
          Muted favorites stay in your list but won't send notifications.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // No gap: rows carry their own divider and must meet.
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  spinner: {
    marginTop: 32,
  },
  // Labels need real air above them now that no card edge separates groups.
  sectionTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  rowName: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  mutedHint: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
