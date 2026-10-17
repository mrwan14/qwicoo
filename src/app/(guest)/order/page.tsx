import { GuestShell } from "@/features/guest/shell";
import { MenuScreen } from "@/features/guest/menu-screen";

export default function OrderPage() {
  return (
    <GuestShell menu>
      <MenuScreen />
    </GuestShell>
  );
}
