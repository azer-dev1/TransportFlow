import { Link } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

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
  } = useSupabaseQuery(
    () =>
      supabase
        .from('notifications')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50),
    [],
  );

  // Mark everything read once the list has loaded — but only once, so the
  // unread styling stays visible for this visit (the badge elsewhere
  // updates via realtime; a refetch here would wipe the highlights).
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current || !notifications?.some((n) => !n.read_at)) return;
    marked.current = true;
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
      {isLoading && <ActivityIndicator style={styles.spinner} />}
      {error && <Text style={styles.error}>Notifications failed to load: {error}</Text>}

      <FlatList
        data={notifications ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        onRefresh={refetch}
        refreshing={isLoading}
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
              {n.trip_id && <Text style={styles.chevron}>›</Text>}
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
            <Text style={styles.empty}>
              No notifications yet. Star a line or stop and you'll hear about its delays,
              cancellations, and service alerts here.
            </Text>
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
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eaecf0',
    padding: 16,
  },
  rowUnread: {
    borderColor: '#84caff',
    backgroundColor: '#f5faff',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#175cd3',
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  message: {
    fontSize: 15,
    color: '#344054',
    lineHeight: 20,
  },
  messageUnread: {
    fontWeight: '600',
    color: '#101828',
  },
  meta: {
    color: '#98a2b3',
    fontSize: 13,
  },
  chevron: {
    fontSize: 22,
    color: '#98a2b3',
  },
  empty: {
    textAlign: 'center',
    color: '#98a2b3',
    marginTop: 48,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
});
