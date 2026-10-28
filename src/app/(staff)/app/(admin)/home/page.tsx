import { HomeScreen } from "@/features/staff/home/home-screen";
import { getApiOrigin } from "@/lib/env";

export default function Page() {
  return <HomeScreen apiOrigin={getApiOrigin()} />;
}
