import createClient, { type Middleware } from "openapi-fetch";

import { getApiOrigin } from "@/lib/env";
import type { paths } from "@/lib/api/schema";

export function createApiClient(options?: {
  token?: string | null;
  brandId?: string | null;
  branchId?: string | null;
}) {
  const client = createClient<paths>({ baseUrl: getApiOrigin() });
  const middleware: Middleware = {
    onRequest({ request }) {
      if (options?.token) {
        request.headers.set("authorization", `Bearer ${options.token}`);
      }
      if (options?.brandId) {
        request.headers.set("x-brand-id", options.brandId);
      }
      if (options?.branchId) {
        request.headers.set("x-branch-id", options.branchId);
      }
      return request;
    },
  };
  client.use(middleware);
  return client;
}
