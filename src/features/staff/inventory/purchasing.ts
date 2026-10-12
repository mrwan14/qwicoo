/** How cancel should call the API. Receipts cannot be undone; they can only be closed. */
export function purchaseCancel(status: string, receivedQty: number): { closeRemaining: boolean } | null {
  if ((status === "DRAFT" || status === "SENT") && receivedQty <= 0) return { closeRemaining: false };
  if (status === "SENT" || status === "PARTIALLY_RECEIVED") return { closeRemaining: true };
  return null;
}
