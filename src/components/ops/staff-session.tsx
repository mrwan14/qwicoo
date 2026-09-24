"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { UserProfile } from "@/lib/auth/roles";

const StaffSessionContext = createContext<UserProfile | null>(null);

export function StaffSessionProvider({
  value,
  children,
}: {
  value: UserProfile | null;
  children: ReactNode;
}) {
  return (
    <StaffSessionContext.Provider value={value}>{children}</StaffSessionContext.Provider>
  );
}

export function useStaffSession(): UserProfile | null {
  return useContext(StaffSessionContext);
}
