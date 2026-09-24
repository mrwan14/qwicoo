import { GuestShell } from "@/features/guest/shell";
import { ServiceScreen } from "@/features/guest/service-screen";

export default function ServicePage() {
  return (
    <GuestShell>
      <ServiceScreen />
    </GuestShell>
  );
}
