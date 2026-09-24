import { RoleGate } from "@/components/ops/screen";
import { ZReportScreen } from "@/features/staff/backoffice-screen";

export default async function Page({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return (
    <RoleGate href="/app/financials">
      <ZReportScreen reportId={reportId} />
    </RoleGate>
  );
}
