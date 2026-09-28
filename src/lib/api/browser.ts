import createClient from "openapi-fetch";

import type { paths } from "@/lib/api/schema";
import { SCOPE_DENIALS, denyAccess, endStaffSession } from "@/lib/auth/session-client";
import { useScope } from "@/stores/scope";

export const browserApi = createClient<paths>({
  baseUrl: "",
  credentials: "include",
});

browserApi.use({
  onRequest({ request }) {
    const { brandId, branchId } = useScope.getState();
    if (brandId) request.headers.set("x-brand-id", brandId);
    if (branchId) request.headers.set("x-branch-id", branchId);
    return request;
  },
  async onResponse({ response }) {
    if (response.status === 401) {
      void endStaffSession();
      return response;
    }
    if (response.status === 403) {
      const payload = (await response.clone().json().catch(() => null)) as { detail?: unknown } | null;
      if (typeof payload?.detail === "string" && SCOPE_DENIALS.has(payload.detail)) denyAccess();
    }
    return response;
  },
});
