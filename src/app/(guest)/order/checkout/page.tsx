import { CheckoutScreen } from "@/features/guest/checkout-screen";
import { GuestShell } from "@/features/guest/shell";

export default function CheckoutPage() {
  return (
    <GuestShell>
      <CheckoutScreen />
    </GuestShell>
  );
}
