import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

/**
 * Subscribes to PostgreSQL database changes on a table
 * and automatically invalidates specified TanStack Query keys.
 */
export function useRealtimeSubscription(
  table: string,
  queryKeysToInvalidate: any[][]
) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`realtime-db-changes:${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
        },
        (payload) => {
          console.log(`[Realtime] Change received on ${table}:`, payload);
          // Invalidate each of the specified query caches
          queryKeysToInvalidate.forEach((queryKey) => {
            queryClient.invalidateQueries({ queryKey });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, queryKeysToInvalidate, queryClient, supabase]);
}
