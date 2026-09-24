import { GuestShell } from "@/features/guest/shell";
import { TrackScreen } from "@/features/guest/track-screen";

export default function TrackPage() {
  return (
    <GuestShell>
      <TrackScreen />
    </GuestShell>
  );
}
