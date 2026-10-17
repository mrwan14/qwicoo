/** Figures shown only after the drawer is closed. An open drawer stays blind. */
export function drawerCloseFigures(session: {
  status?: string | null;
  calculated_cash_amount?: string | null;
  cash_variance?: string | null;
} | null): { calculated: string | null; variance: string | null } | null {
  if (!session || session.status !== "CLOSED") return null;
  return {
    calculated: session.calculated_cash_amount ?? null,
    variance: session.cash_variance ?? null,
  };
}
