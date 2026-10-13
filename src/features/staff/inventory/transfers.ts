import type { UserRole } from "@/lib/auth/roles";
import type { LocaleCode } from "@/lib/i18n/locale-text";
import { pickLocale } from "@/lib/i18n/locale-text";

import { canWriteCentralKitchen, canWriteStock } from "./access";

const FSI = "\u2068";
const PDI = "\u2069";

export type WarehouseLabelInput = {
  name?: string | null;
  kind?: string | null;
  type?: string | null;
  is_central?: boolean;
  /** Bilingual branch name, or a name already resolved for one locale. Never the stored warehouse name. */
  branchName?: unknown;
  branch_name?: unknown;
};

/** "Branch name · Branch store" or "Kitchen name · Central kitchen", each part isolated for RTL. */
export function warehouseLabel(
  warehouse: WarehouseLabelInput,
  locale: LocaleCode,
  labels: { branchStore: string; centralKitchen: string },
): string {
  const central = warehouse.is_central === true || warehouse.kind === "CENTRAL_KITCHEN" || warehouse.type === "CENTRAL_KITCHEN";
  const place = central ? (warehouse.name ?? "").trim() : pickLocale(warehouse.branch_name ?? warehouse.branchName, locale).trim();
  const type = central ? labels.centralKitchen : labels.branchStore;
  return [place, type]
    .filter(Boolean)
    .map((part) => `${FSI}${part}${PDI}`)
    .join(" · ");
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
