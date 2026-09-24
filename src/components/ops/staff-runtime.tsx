"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

import { RoleChrome } from "@/components/ops/shells";
import { LoadingState } from "@/components/ops/states";
import { StaffSessionProvider } from "@/components/ops/staff-session";
import { WorkspaceBootstrap } from "@/components/ops/brand-branch-switcher";
import { browserApi } from "@/lib/api/browser";
import { useWorkspace } from "@/stores/workspace";

export function StaffRuntime({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void useWorkspace.persist.rehydrate();
    setHydrated(true);
  }, []);

  const me = useQuery({
    queryKey: ["auth", "me"],
    enabled: hydrated,
    retry: false,
    queryFn: async () => {
      const { data, response } = await browserApi.GET("/api/v1/auth/me");
      if (response.status === 401) {
        window.location.assign("/api/auth/logout");
        throw new Error("Unauthorized");
      }
      if (!response.ok || !data) throw new Error("Could not load your profile");
      return data;
    },
  });

  if (!hydrated || me.isLoading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <LoadingState label="Loading your session" />
      </main>
    );
  }

  if (me.isError || !me.data) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm" role="alert">
          Your session could not be loaded.{" "}
          <a className="underline" href="/api/auth/logout">
            Sign in again
          </a>
        </p>
      </main>
    );
  }

  return (
    <StaffSessionProvider value={me.data}>
      <WorkspaceBootstrap />
      <RoleChrome>{children}</RoleChrome>
    </StaffSessionProvider>
  );
}
