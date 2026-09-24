import { RoleGate } from "@/components/ops/screen";
import { QrScreen } from "@/features/staff/qr-screen";

export default function Page() {
  return (
    <RoleGate href="/app/qr">
      <QrScreen />
    </RoleGate>
  );
}
