import createClient from "openapi-fetch";

import type { paths } from "@/lib/api/schema";
import { useWorkspace } from "@/stores/workspace";

export const browserApi = createClient<paths>({
  baseUrl: "",
  credentials: "include",
});

browserApi.use({
  onRequest({ request }) {
    const { brandId, branchId } = useWorkspace.getState();
    if (brandId) request.headers.set("x-brand-id", brandId);
    if (branchId) request.headers.set("x-branch-id", branchId);
    return request;
  },
});
