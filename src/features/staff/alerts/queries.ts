"use client";

import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";

/** Same keys and endpoints as the Kitchen, Handover, Requests and Payments screens, so React Query shares one fetch. */
export const kdsTicketsKey = (branchId: string | null) => ["kds-tickets", branchId] as const;
export const expoKey = (branchId: string | null) => ["expo", branchId] as const;
export const serviceQueueKey = (branchId: string | null) => ["service-queue", branchId] as const;
export const paymentsPendingKey = (branchId: string | null) => ["payments-pending", branchId] as const;

export async function fetchKdsTickets() {
  const result = await browserApi.GET("/api/v1/kds/tickets");
  if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Tickets failed");
  return result.data;
}

export async function fetchExpoOrders() {
  const result = await browserApi.GET("/api/v1/kds/expo/orders");
  if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Expo failed");
  return result.data;
}

export async function fetchServiceQueue() {
  const result = await browserApi.GET("/api/v1/service-requests/active");
  if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Queue failed");
  return result.data;
}

export async function fetchPendingPayments() {
  const result = await browserApi.GET("/api/v1/payments/branch/pending");
  if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Payments failed");
  return result.data;
}
