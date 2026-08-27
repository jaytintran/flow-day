import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // local DB, only invalidate manually on writes
      refetchOnWindowFocus: false,
    },
  },
});
