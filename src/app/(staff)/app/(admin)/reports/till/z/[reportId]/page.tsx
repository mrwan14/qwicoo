import { RoleGate } from "@/components/ops/screen";
import { ZReportDetail } from "@/features/staff/reports/z-detail";

export default async function Page({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return (
    <RoleGate href="/app/reports/till">
      <ZReportDetail reportId={reportId} />
    </RoleGate>
  );
}
