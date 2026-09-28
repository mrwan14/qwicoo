import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/error";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A 4xx answer won't change on a second try.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 1,
        staleTime: 10_000,
        refetchIntervalInBackground: false,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/** One client per browser tab so sign-out and branch switches can clear it outside React. */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}
