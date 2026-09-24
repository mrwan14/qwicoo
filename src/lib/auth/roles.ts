import type { components } from "@/lib/api/schema";

export type UserRole = components["schemas"]["UserRole"];
export type UserProfile = components["schemas"]["UserResponse"];

const ROLE_HOME: Record<UserRole, string> = {
  SUPER_ADMIN: "/app/brands",
  BRAND_ADMIN: "/app/brands",
  REGIONAL_MANAGER: "/app/brands",
  BRANCH_ADMIN: "/app/floor",
  CASHIER: "/app/pos",
  WAITER: "/app/floor",
  RUNNER: "/app/floor",
  KITCHEN_STAFF: "/app/kds",
};

export function roleHome(role: UserRole): string {
  return ROLE_HOME[role];
}

export function roleLabel(role: UserRole): string {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
