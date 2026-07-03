import { useState } from 'react';

import { useAuth } from './auth-context';
import { supabase } from './supabase';
import { useSupabaseQuery } from './use-supabase-query';

/**
 * The signed-in user's favorites with joined display names, plus toggle
 * helpers. A favorite is either a line or a stop (DB check constraint);
 * RLS scopes every read/write to the owner.
 */
export function useFavorites() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const {
    data: favorites,
    error,
    isLoading,
    refetch,
  } = useSupabaseQuery(
    () =>
      supabase
        .from('favorites')
        .select('id, line_id, stop_id, lines(id, name, mode), stops(id, name)')
        .eq('user_id', userId!),
    [userId],
  );

  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const lineFavorite = (lineId: string) => favorites?.find((f) => f.line_id === lineId);
  const stopFavorite = (stopId: string) => favorites?.find((f) => f.stop_id === stopId);

  async function toggle(favorite: { id: string } | undefined, insert: { line_id?: string; stop_id?: string }) {
    if (!userId || isMutating) return;
    setIsMutating(true);
    setMutationError(null);
    const { error: mutateError } = favorite
      ? await supabase.from('favorites').delete().eq('id', favorite.id)
      : await supabase.from('favorites').insert({ user_id: userId, ...insert });
    if (mutateError) setMutationError(mutateError.message);
    refetch();
    setIsMutating(false);
  }

  return {
    favorites: favorites ?? [],
    error,
    isLoading,
    refetch,
    isMutating,
    mutationError,
    isLineFavorite: (lineId: string) => !!lineFavorite(lineId),
    isStopFavorite: (stopId: string) => !!stopFavorite(stopId),
    toggleLine: (lineId: string) => toggle(lineFavorite(lineId), { line_id: lineId }),
    toggleStop: (stopId: string) => toggle(stopFavorite(stopId), { stop_id: stopId }),
  };
}
