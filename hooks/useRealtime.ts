import { useEffect, useId, useMemo, useRef } from 'react';
import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

/**
 * Subscribes to PostgreSQL database changes on a table
 * and automatically invalidates specified TanStack Query keys.
 */
export function useRealtimeSubscription(
  table: string,
  queryKeysToInvalidate: QueryKey[]
) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const instanceId = useId().replace(/:/g, '');
  const queryKeysRef = useRef(queryKeysToInvalidate);

  useEffect(() => {
    queryKeysRef.current = queryKeysToInvalidate;
  }, [queryKeysToInvalidate]);

  useEffect(() => {
    const channelName = `realtime-db-changes:${table}:${instanceId}`;
    const existingChannel = supabase
      .getChannels()
      .find((channel) => channel.topic === `realtime:${channelName}`);
    const canReuseChannel =
      existingChannel?.state === 'joined' || existingChannel?.state === 'joining';

    const channel = existingChannel || supabase.channel(channelName);

    if (!canReuseChannel) {
      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
          },
          (payload) => {
            console.log(`[Realtime] Change received on ${table}:`, payload);
            // Invalidate each of the specified query caches.
            queryKeysRef.current.forEach((queryKey) => {
              queryClient.invalidateQueries({ queryKey });
            });
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(channel).catch((error) => {
        console.error(`[Realtime] Failed to remove channel for ${table}:`, error);
      });
    };
  }, [table, instanceId, queryClient, supabase]);
}
