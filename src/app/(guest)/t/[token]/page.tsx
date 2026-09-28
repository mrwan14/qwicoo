import { GuestShell } from "@/features/guest/shell";
import { PresenceForm } from "@/features/guest/presence-form";

export default async function TablePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <GuestShell neutral>
      <PresenceForm token={token} />
    </GuestShell>
  );
}
