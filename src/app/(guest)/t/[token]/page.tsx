import { GuestShell } from "@/features/guest/shell";
import { TableEntry } from "@/features/guest/presence-form";

/** Scanning a table QR opens the menu; joining the table waits for the first add. */
export default async function TablePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <GuestShell neutral header={false}>
      <TableEntry token={token} />
    </GuestShell>
  );
}
