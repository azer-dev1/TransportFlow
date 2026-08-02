import { useCallback, useEffect, useRef, useState } from 'react';

type QueryState<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
};

/**
 * Minimal fetch-on-mount wrapper for a supabase query builder call.
 * `query` runs whenever `deps` change; superseded responses are dropped.
 * `refetch` resolves once the fresh data has been applied, so callers can
 * sequence optimistic UI against it.
 * The generic ranges over the whole response because supabase returns a
 * discriminated union (success/failure) that breaks inference on `data` alone.
 */
export function useSupabaseQuery<R extends { data: unknown; error: { message: string } | null }>(
  query: () => PromiseLike<R>,
  deps: unknown[],
): QueryState<NonNullable<R['data']>> & { refetch: () => Promise<void>; isRefreshing: boolean } {
  type Data = NonNullable<R['data']>;
  const [state, setState] = useState<QueryState<Data>>({
    data: null,
    error: null,
    isLoading: true,
  });
  // isLoading covers the initial fetch (no data yet, show a spinner);
  // isRefreshing covers refetch() re-runs — data is already on screen, so
  // screens show the small Spinner above the list instead of blanking it.
  const [isRefreshing, setIsRefreshing] = useState(false);

  const queryRef = useRef(query);
  queryRef.current = query;
  const requestId = useRef(0);

  const run = useCallback(async (isRefetch: boolean) => {
    const id = ++requestId.current;
    if (isRefetch) setIsRefreshing(true);
    const { data, error } = await queryRef.current();
    if (id !== requestId.current) return;
    setState({ data: (data ?? null) as Data | null, error: error?.message ?? null, isLoading: false });
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refetch = useCallback(() => run(true), [run]);

  return { ...state, refetch, isRefreshing };
}
