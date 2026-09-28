import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { StaffRuntime } from "@/components/ops/staff-runtime";
import { STAFF_TOKEN_COOKIE } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = (await cookies()).get(STAFF_TOKEN_COOKIE)?.value;
  if (!token) redirect("/login");
  return <StaffRuntime>{children}</StaffRuntime>;
}
