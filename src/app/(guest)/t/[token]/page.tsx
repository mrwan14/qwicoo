import { GuestShell } from "@/features/guest/shell";
import { PresenceForm } from "@/features/guest/presence-form";
import { QwicooSplash } from "@/features/guest/qwicoo-splash";

export default async function TablePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <GuestShell neutral>
      <QwicooSplash sessionKey={token} />
      <PresenceForm token={token} />
    </GuestShell>
  );
}
