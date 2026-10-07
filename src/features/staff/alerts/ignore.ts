"use client";

import { addIgnore, pruneIgnore, type IgnoreList } from "./diff";

/** Device-local: changes this person just made, so they don't hear their own action. */
export const alertIgnoreList: IgnoreList = new Map();

export function ignoreOwnChange(entityId: string, status: string): void {
  const now = Date.now();
  pruneIgnore(alertIgnoreList, now);
  addIgnore(alertIgnoreList, entityId, status, now);
}

/** Kitchen tickets that have been opened or bumped, so they won't re-chime. Keyed by order id. */
export const acknowledgedOrders = new Set<string>();

export function acknowledgeOrder(orderId: string): void {
  acknowledgedOrders.add(orderId);
}
