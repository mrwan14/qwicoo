import type { UserRole } from "@/lib/auth/roles";
import type { LocaleCode } from "@/lib/i18n/locale-text";
import { pickLocale } from "@/lib/i18n/locale-text";

import { canWriteCentralKitchen, canWriteStock } from "./access";

const FSI = "\u2068";
const PDI = "\u2069";

export type TransferDestinationOption = {
  id: string;
  name: string;
  branch_name?: unknown;
  is_central: boolean;
};

/** "Store, Branch" with each part isolated so Arabic and English stay in order. */
export function transferDestinationLabel(
  destination: Pick<TransferDestinationOption, "name" | "branch_name" | "is_central">,
  locale: LocaleCode,
  centralKitchen: string,
): string {
  const place = destination.is_central ? centralKitchen : pickLocale(destination.branch_name, locale);
  const separator = locale === "ar" ? "، " : ", ";
  return [destination.name, place]
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `${FSI}${part}${PDI}`)
    .join(separator);
}

/** Drop the store the transfer is leaving. */
export function transferTargets<T extends { id: string }>(destinations: readonly T[], sourceId: string): T[] {
  return destinations.filter((item) => item.id !== sourceId);
}

export type ReceiveScopeWarehouse = {
  id: string;
  branchId: string | null;
  central: boolean;
};

/**
 * Receive writes the destination. A branch role only writes the focused branch's stores,
 * so a request into another branch does not offer Receive.
 */
export function canReceiveTransfer({
  role,
  status,
  toWarehouseId,
  focusedBranchId,
  warehouses,
}: {
  role: UserRole | null | undefined;
  status: string;
  toWarehouseId: string;
  focusedBranchId: string;
  warehouses: readonly ReceiveScopeWarehouse[];
}): boolean {
  if (status !== "SENT" || !canWriteStock(role) || !focusedBranchId) return false;
  const destination = warehouses.find((item) => item.id === toWarehouseId);
  if (!destination) return false;
  if (destination.central) return canWriteCentralKitchen(role);
  return destination.branchId === focusedBranchId;
}
