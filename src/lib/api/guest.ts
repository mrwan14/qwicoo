import createClient from "openapi-fetch";

import type { paths } from "@/lib/api/schema";
import { useGuest } from "@/stores/guest";

export const guestApi = createClient<paths>({
  baseUrl: "/api/guest",
  credentials: "include",
});

guestApi.use({
  onRequest({ request }) {
    const session = useGuest.getState().session;
    if (session?.branchId) request.headers.set("x-branch-id", session.branchId);
    if (session?.brandId) request.headers.set("x-brand-id", session.brandId);
    return request;
  },
});
