import createClient from "openapi-fetch";

import type { paths } from "@/lib/api/schema";
import { SCOPE_DENIALS, denyAccess, endStaffSession } from "@/lib/auth/session-client";
import { currentLocale } from "@/lib/i18n/locale-store";
import { useNetwork } from "@/lib/offline/network";
import { useScope } from "@/stores/scope";

export const browserApi = createClient<paths>({
  baseUrl: "",
  credentials: "include",
});

browserApi.use({
  onRequest({ request }) {
    request.headers.set("accept-language", currentLocale());
    const { brandId, branchId } = useScope.getState();
    if (brandId) request.headers.set("x-brand-id", brandId);
    if (branchId) request.headers.set("x-branch-id", branchId);
    return request;
  },
  async onResponse({ response }) {
    // 502–504 come from our proxy or the edge when the API itself can't be reached.
    if (response.status === 502 || response.status === 503 || response.status === 504) useNetwork.getState().markOffline();
    else useNetwork.getState().markOnline();
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
  onError() {
    // fetch itself failed: no network, or the app's own server is unreachable.
    useNetwork.getState().markOffline();
  },
});
