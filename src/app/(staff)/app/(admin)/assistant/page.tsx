import { RoleGate } from "@/components/ops/screen";
import { AskQwicoo } from "@/features/staff/assistant/ask-qwicoo";

export default function Page() {
  return (
    <RoleGate href="/app/assistant">
      <AskQwicoo autoFocus />
    </RoleGate>
  );
}
