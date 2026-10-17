export const STORE_LOW_AT = 5;

export type StoreStockBadge = "low" | "out" | null;

export function storeStockView(onHand: number, held: number): { available: number; badge: StoreStockBadge } {
  const available = onHand - held;
  if (available <= 0) return { available, badge: "out" };
  if (available <= STORE_LOW_AT) return { available, badge: "low" };
  return { available, badge: null };
}

export function isRetailType(value: string | null | undefined): boolean {
  return (value ?? "").trim().toUpperCase() === "RETAIL";
}

export type SessionStoreItem = {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  price: string;
  available: boolean;
  maxPerOrder: number | null;
  imageUrl: string | null;
  categoryId: string;
  brandWide: boolean;
};

const KEY = "qwicoo-store-session-items";

export function readSessionStoreItems(): SessionStoreItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SessionStoreItem => {
      if (!item || typeof item !== "object") return false;
      const row = item as SessionStoreItem;
      return typeof row.id === "string" && typeof row.nameEn === "string";
    });
  } catch {
    return [];
  }
}

export function writeSessionStoreItems(items: SessionStoreItem[]) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(items));
}
