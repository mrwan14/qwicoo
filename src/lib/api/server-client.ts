import createClient, { type Middleware } from "openapi-fetch";

import { getApiOrigin } from "@/lib/env";
import type { paths } from "@/lib/api/schema";
import type { LocaleCode } from "@/lib/i18n/locale-text";

/** `ar` when the caller asked for Arabic. Anything else gets English. */
export function requestLocale(request: Request): LocaleCode {
  return request.headers.get("accept-language")?.trim().toLowerCase().startsWith("ar") ? "ar" : "en";
}

/** The guest's chosen language, sent by the guest client. */
export function guestLocale(request: Request): LocaleCode {
  return requestLocale(request);
}

export function createApiClient(options?: {
  token?: string | null;
  brandId?: string | null;
  branchId?: string | null;
  locale?: LocaleCode;
}) {
  const client = createClient<paths>({ baseUrl: getApiOrigin() });
  const middleware: Middleware = {
    onRequest({ request }) {
      // The API defaults to Arabic when no language is asked for.
      request.headers.set("accept-language", options?.locale ?? "en");
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
