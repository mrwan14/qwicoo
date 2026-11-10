"use client";

import { useQuery } from "@tanstack/react-query";
import { TicketPercent, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ops/kit/button";
import { Input } from "@/components/ops/kit/field";
import { Money } from "@/components/ops/money";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { posCopy } from "@/lib/i18n/staff/pos";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

type Preview = components["schemas"]["POSPromoPreviewResponse"];

export type TicketPromoState = {
  /** The code the cashier applied, or null. */
  code: string | null;
  /** Server preview for the current ticket; undefined while checking or when there is no code. */
  preview: Preview | undefined;
  /** Why the code can't be used on this ticket right now. */
  error: string | null;
  checking: boolean;
  /** Checkout must wait: the code is still being checked, or it can't be used. */
  blocksSend: boolean;
};

/**
 * The till's promo code, checked against the server for the ticket as it is now. It is checked
 * again whenever the subtotal, order type or table changes, so the discount shown is the one
 * checkout will apply. Codes need the network: offline there is no code.
 */
export function useTicketPromo(input: {
  code: string | null;
  branchId: string | null;
  subtotal: string;
  orderType: "DINE_IN" | "TAKEAWAY";
  tableId: string;
  online: boolean;
  hasLines: boolean;
}): TicketPromoState {
  const t = useStaffSection(posCopy);
  const { locale } = useLocale();
  const tableId = input.orderType === "DINE_IN" && input.tableId.trim() ? input.tableId : null;
  const active = Boolean(input.code && input.branchId && input.online && input.hasLines);
  const preview = useQuery({
    queryKey: ["pos-promo", input.branchId, input.code, input.subtotal, input.orderType, tableId],
    enabled: active,
    retry: false,
    staleTime: 15_000,
    queryFn: async () => {
      const result = await browserApi.POST("/api/v1/pos/promo/preview", {
        body: { promo_code: input.code ?? "", order_type: input.orderType, table_id: tableId, subtotal: input.subtotal },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.promo.failed, locale);
      return result.data;
    },
  });
  if (!active) return { code: input.code, preview: undefined, error: null, checking: false, blocksSend: false };
  const error = preview.isError ? preview.error.message : null;
  return {
    code: input.code,
    preview: preview.data,
    error,
    checking: preview.isFetching,
    blocksSend: preview.isFetching || Boolean(error) || !preview.data,
  };
}

/** Ticket row: "Add promo code", then the code field, then the applied code with its discount. */
export function TicketPromo({
  state,
  online,
  ticketSubtotal,
  onApply,
  onRemove,
}: {
  state: TicketPromoState;
  online: boolean;
  /** This ticket's item subtotal; a larger eligible subtotal means the table's open order counts too. */
  ticketSubtotal: string;
  onApply: (code: string) => void;
  onRemove: () => void;
}) {
  const t = useStaffSection(posCopy);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  if (!online) {
    return <p className="text-[13px] text-ink-secondary">{t.promo.offline}</p>;
  }

  if (state.code) {
    const wholeOrder = state.preview ? Number(state.preview.eligible_subtotal) > Number(ticketSubtotal) : false;
    return (
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2 text-[15px]">
          <span className="flex min-w-0 items-center gap-2">
            <TicketPercent aria-hidden className="size-4 shrink-0 text-ink-secondary" />
            <span className="truncate font-medium">{fill(t.promo.applied, { code: state.preview?.code ?? state.code })}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {state.preview ? (
              <span className="tabular-nums text-success">
                −<Money amount={state.preview.discount_amount} />
              </span>
            ) : null}
            <button
              type="button"
              aria-label={`${t.promo.remove} ${state.code}`}
              className="inline-flex size-9 items-center justify-center rounded-staff text-ink-secondary hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
              onClick={() => {
                onRemove();
                setDraft("");
                setOpen(false);
              }}
            >
              <X aria-hidden className="size-4" />
            </button>
          </span>
        </div>
        {state.checking ? <p className="text-[13px] text-ink-secondary">{t.promo.checking}</p> : null}
        {state.error ? (
          <p role="alert" className="rounded-staff bg-danger-bg px-3 py-2 text-[13px] text-ink">
            {state.error}
          </p>
        ) : null}
        {wholeOrder && !state.error ? <p className="text-[13px] text-ink-secondary">{t.promo.wholeOrder}</p> : null}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="flex w-fit items-center gap-2 rounded-staff text-[14px] font-medium text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        onClick={() => setOpen(true)}
      >
        <TicketPercent aria-hidden className="size-4" />
        {t.promo.add}
      </button>
    );
  }

  const apply = () => {
    const code = draft.trim().toUpperCase();
    if (code) onApply(code);
  };

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <Input
        autoFocus
        aria-label={t.promo.label}
        placeholder={t.promo.label}
        value={draft}
        maxLength={32}
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 font-mono uppercase [&_input]:h-11"
        onChange={(event) => setDraft(event.target.value.toUpperCase().replace(/\s+/g, ""))}
      />
      <Button type="submit" className="h-11" disabled={!draft.trim()}>
        {t.promo.apply}
      </Button>
      <button
        type="button"
        aria-label={t.promo.remove}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-staff text-ink-secondary hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
        onClick={() => {
          setOpen(false);
          setDraft("");
        }}
      >
        <X aria-hidden className="size-4" />
      </button>
    </form>
  );
}
