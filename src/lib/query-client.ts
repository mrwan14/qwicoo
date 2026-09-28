import { QueryClient } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
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
