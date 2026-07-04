import { useState } from 'react';

import { useAuth } from './auth-context';
import { supabase } from './supabase';
import { useSupabaseQuery } from './use-supabase-query';

/**
 * The signed-in user's favorites with joined display names, plus toggle
 * helpers. A favorite is either a line or a stop (DB check constraint);
 * RLS scopes every read/write to the owner.
 *
 * Toggles are optimistic: the star/bell flips on tap, the override is
 * dropped once refetched server data confirms it, and an error rolls the
 * UI back (surfaced via mutationError).
 */
export function useFavorites() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const {
    data: favorites,
    error,
    isLoading,
    refetch,
    isRefreshing,
  } = useSupabaseQuery(
    () =>
      supabase
        .from('favorites')
        .select('id, line_id, stop_id, muted, lines(id, name, mode), stops(id, name)')
        .eq('user_id', userId!),
    [userId],
  );

  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [starOverrides, setStarOverrides] = useState<Record<string, boolean>>({});
  const [muteOverrides, setMuteOverrides] = useState<Record<string, boolean>>({});

  const lineFavorite = (lineId: string) => favorites?.find((f) => f.line_id === lineId);
  const stopFavorite = (stopId: string) => favorites?.find((f) => f.stop_id === stopId);

  async function toggle(
    key: string,
    favorite: { id: string } | undefined,
    insert: { line_id?: string; stop_id?: string },
  ) {
    if (!userId || isMutating) return;
    setIsMutating(true);
    setMutationError(null);
    setStarOverrides((s) => ({ ...s, [key]: !favorite }));
    const { error: mutateError } = favorite
      ? await supabase.from('favorites').delete().eq('id', favorite.id)
      : await supabase.from('favorites').insert({ user_id: userId, ...insert });
    if (mutateError) setMutationError(mutateError.message);
    else await refetch();
    setStarOverrides(({ [key]: _, ...rest }) => rest);
    setIsMutating(false);
  }

  /** Muted favorites stay starred but are excluded from notification fan-out. */
  async function setMuted(favoriteId: string, muted: boolean) {
    if (isMutating) return;
    setIsMutating(true);
    setMutationError(null);
    setMuteOverrides((m) => ({ ...m, [favoriteId]: muted }));
    const { error: mutateError } = await supabase
      .from('favorites')
      .update({ muted })
      .eq('id', favoriteId);
    if (mutateError) setMutationError(mutateError.message);
    else await refetch();
    setMuteOverrides(({ [favoriteId]: _, ...rest }) => rest);
    setIsMutating(false);
  }

  return {
    favorites: (favorites ?? []).map((f) =>
      muteOverrides[f.id] === undefined ? f : { ...f, muted: muteOverrides[f.id] },
    ),
    error,
    isLoading,
    refetch,
    isRefreshing,
    isMutating,
    mutationError,
    setMuted,
    isLineFavorite: (lineId: string) => starOverrides[`line:${lineId}`] ?? !!lineFavorite(lineId),
    isStopFavorite: (stopId: string) => starOverrides[`stop:${stopId}`] ?? !!stopFavorite(stopId),
    toggleLine: (lineId: string) =>
      toggle(`line:${lineId}`, lineFavorite(lineId), { line_id: lineId }),
    toggleStop: (stopId: string) =>
      toggle(`stop:${stopId}`, stopFavorite(stopId), { stop_id: stopId }),
  };
}
