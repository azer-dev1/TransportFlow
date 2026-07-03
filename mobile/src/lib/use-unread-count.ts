import { useEffect, useState } from 'react';

import { useAuth } from './auth-context';
import { supabase } from './supabase';

/**
 * Live unread-notification count for the signed-in user. Fetches a head
 * count (no rows) and re-fetches on any notifications INSERT/UPDATE for
 * this user (requires notifications in the realtime publication,
 * migration 9). RLS scopes both the count and the stream to the owner.
 */
export function useUnreadCount(): number {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    let cancelled = false;

    const fetchCount = async () => {
      const { count: unread } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);
      if (!cancelled && unread !== null) setCount(unread);
    };
    fetchCount();

    const channel = supabase
      .channel(`unread-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        fetchCount,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
}
