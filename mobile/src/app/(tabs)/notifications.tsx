import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { ErrorText } from '@/components/ErrorText';
import { Spinner } from '@/components/Spinner';
import { colors, fontSize, radii, spacing } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/use-supabase-query';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function NotificationsScreen() {
  const {
    data: notifications,
    error,
    isLoading,
    refetch,
    isRefreshing,
  } = useSupabaseQuery(
    () =>
      supabase
        .from('notifications')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50),
    [],
  );

  // The tab stays mounted, so refresh on every re-focus (mount covers the
  // first one). The mark-read effect below then clears the badge while the
  // unread styling stays visible until the next refetch.
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

  // Whenever the list contains unread rows, mark them read in the DB (the
  // tab badge updates via realtime). The local rows keep their unread look
  // for this visit because we deliberately don't refetch here.
  useEffect(() => {
    if (!notifications?.some((n) => !n.read_at)) return;
    supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
      .then(({ error: markError }) => {
        if (markError) console.warn('mark-read failed:', markError.message);
      });
  }, [notifications]);

  return (
    <View style={styles.container}>
      {isLoading && <Spinner style={styles.spinner} />}
      {error && <ErrorText style={styles.errorPadded}>Notifications failed to load: {error}</ErrorText>}

      <FlatList
        data={notifications ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        onRefresh={refetch}
        refreshing={isRefreshing}
        renderItem={({ item: n }) => {
          const body = (
            <View style={[styles.row, !n.read_at && styles.rowUnread]}>
              {!n.read_at && <View style={styles.unreadDot} />}
              <View style={styles.rowBody}>
                <Text style={[styles.message, !n.read_at && styles.messageUnread]}>
                  {n.message}
                </Text>
                <Text style={styles.meta}>{formatWhen(n.sent_at)}</Text>
              </View>
              {n.trip_id && (
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              )}
            </View>
          );
          return n.trip_id ? (
            <Link href={`/trips/${n.trip_id}`} asChild>
              <Pressable>{body}</Pressable>
            </Link>
          ) : (
            body
          );
        }}
        ListEmptyComponent={
          !isLoading && !error ? (
            <EmptyState>
              No notifications yet. Star a line or stop and you'll hear about its delays,
              cancellations, and service alerts here.
            </EmptyState>
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
  spinner: {
    marginTop: 32,
  },
  errorPadded: {
    padding: spacing.lg,
  },
  list: {
    padding: spacing.lg,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  rowUnread: {
    borderColor: colors.unreadBorder,
    backgroundColor: colors.unreadSurface,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  message: {
    fontSize: fontSize.sm,
    color: colors.textBody,
    lineHeight: 20,
  },
  messageUnread: {
    fontWeight: '600',
    color: colors.text,
  },
  meta: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
  },
});
