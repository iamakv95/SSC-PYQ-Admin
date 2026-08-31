import type { QueryClient, QueryKey } from '@tanstack/react-query'

/**
 * Active toggles previously had no optimistic update at all — clicking one did nothing visible
 * until the round-trip to the Edge Function finished and the list query refetched, which reads
 * as "broken"/unresponsive even though the write itself worked. This patches the cached list (or
 * whatever shape `updater` describes) immediately on click, and rolls back to the pre-click
 * snapshot if the request actually fails — same optimistic-patch-with-rollback discipline the
 * mobile app already uses for this exact class of interaction.
 */
export function makeOptimisticToggle<TData>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updater: (data: TData, id: string, active: boolean) => TData,
) {
  return {
    onMutate: async ({ id, active }: { id: string; active: boolean }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<TData>(queryKey)
      if (previous !== undefined) {
        queryClient.setQueryData<TData>(queryKey, updater(previous, id, active))
      }
      return { previous }
    },
    onError: (_err: unknown, _vars: { id: string; active: boolean }, context: { previous?: TData } | undefined) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKey, context.previous)
    },
  }
}
