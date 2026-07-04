import { useCallback, useEffect, useState } from 'react';

type QueryState<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
};

/**
 * Minimal fetch-on-mount wrapper for a supabase query builder call.
 * `query` runs whenever `deps` change; unmounted/superseded responses are dropped.
 * The generic ranges over the whole response because supabase returns a
 * discriminated union (success/failure) that breaks inference on `data` alone.
 */
export function useSupabaseQuery<R extends { data: unknown; error: { message: string } | null }>(
  query: () => PromiseLike<R>,
  deps: unknown[],
): QueryState<NonNullable<R['data']>> & { refetch: () => void; isRefreshing: boolean } {
  type Data = NonNullable<R['data']>;
  const [state, setState] = useState<QueryState<Data>>({
    data: null,
    error: null,
    isLoading: true,
  });
  // isLoading covers the initial fetch (no data yet, show a spinner);
  // isRefreshing covers refetch() re-runs (data on screen, feed it to a
  // RefreshControl instead of blanking the list).
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    query().then(({ data, error }) => {
      if (cancelled) return;
      setState({ data: (data ?? null) as Data | null, error: error?.message ?? null, isLoading: false });
      setIsRefreshing(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const refetch = useCallback(() => {
    setIsRefreshing(true);
    setNonce((n) => n + 1);
  }, []);

  return { ...state, refetch, isRefreshing };
}
