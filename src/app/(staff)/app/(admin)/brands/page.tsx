import { RoleGate } from "@/components/ops/screen";
import { BrandsScreen } from "@/features/staff/brands-screen";

export default function Page() {
  return (
    <RoleGate href="/app/brands">
      <BrandsScreen />
    </RoleGate>
  );
}
