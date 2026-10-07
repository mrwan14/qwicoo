"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Fragment, Suspense, useEffect, useLayoutEffect, useState, type ReactNode } from "react";

import { RoleChrome } from "@/components/ops/shells";
import { StaffSessionProvider } from "@/components/ops/staff-session";
import { OrderAlerts } from "@/features/staff/alerts/order-alerts";
import { AccessDeniedToast, NoWorkspace, WorkspaceLoading } from "@/components/ops/workspace-states";
import { browserApi } from "@/lib/api/browser";
import { endStaffSession } from "@/lib/auth/session-client";
import { useScope } from "@/stores/scope";
import { useWorkspace } from "@/stores/workspace";

export function StaffRuntime({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void useWorkspace.persist.rehydrate();
    setHydrated(true);
  }, []);

  useEffect(() => {
    useScope.getState().setNavigate((href) => router.replace(href));
    return () => useScope.getState().setNavigate(null);
  }, [router]);

  const me = useQuery({
    queryKey: ["auth", "me"],
    enabled: hydrated,
    retry: false,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, response } = await browserApi.GET("/api/v1/auth/me");
      if (response.status === 401) {
        void endStaffSession();
        throw new Error("Unauthorized");
      }
      if (!response.ok || !data) throw new Error("Could not load your profile");
      return data;
    },
  });

  // Layout effect: the scope must be in place before the first shell paint.
  useLayoutEffect(() => {
    if (me.data) useScope.getState().enter(me.data);
  }, [me.data]);

  const scopedUser = useScope((state) => state.userId);
  const blocked = useScope((state) => state.blocked);
  const branchKey = useScope((state) => (state.homeScope === "platform" ? "platform" : (state.branchId ?? "none")));

  if (!hydrated || me.isLoading || (me.data && scopedUser !== me.data.id)) {
    return <WorkspaceLoading />;
  }

  if (me.isError || !me.data) {
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <p className="text-sm" role="alert">
          Your session could not be loaded.{" "}
          <button type="button" className="underline" onClick={() => void endStaffSession()}>
            Sign in again
          </button>
        </p>
      </main>
    );
  }

  if (blocked) return <NoWorkspace />;

  return (
    <StaffSessionProvider value={me.data}>
      <Suspense fallback={null}>
        <AccessDeniedToast />
      </Suspense>
      <OrderAlerts />
      <RoleChrome>
        {/* Remount screens on branch change so no local state (tickets, filters) crosses branches. */}
        <Fragment key={branchKey}>{children}</Fragment>
      </RoleChrome>
    </StaffSessionProvider>
  );
}
