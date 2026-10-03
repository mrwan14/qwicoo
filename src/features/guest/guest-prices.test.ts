import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { formatMoney } from "../../lib/format/money.ts";
import {
  branchUnitPrice,
  guestQuoteFigures,
  quotedLineSubtotal,
  quotedOrderTotal,
} from "./guest-prices.ts";

/**
 * ZZ Mousa Drive: Latte catalogue price 60, branch override 65,
 * Medium +10, oat milk +15, 14% tax, no service fee.
 * Quote: subtotal 90, tax 12.60, total 102.60.
 * The old screen showed 60 on the tile and 115 in the cart (90 plus the deltas again).
 */
const latte = {
  tile: { base_price: "60.00", final_price: "65.00" },
  line: {
    unit_price: "90.00",
    subtotal: "90.00",
    modifier_deltas: ["10.00", "15.00"],
  },
  pricing: {
    subtotal: "90.00",
    discount_total: "0.00",
    service_fee_total: "0.00",
    tax_total: "12.60",
    total: "102.60",
  },
};

test("branch override of 65 plus size and milk and 14% tax renders 102.60", () => {
  const tile = branchUnitPrice(latte.tile);
  const line = quotedLineSubtotal(latte.line);
  const figures = guestQuoteFigures(latte.pricing);
  const orderTotal = quotedOrderTotal(latte.pricing);
  const html = renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement("p", null, formatMoney(tile, "EGP", "en")),
      createElement("p", null, formatMoney(line, "EGP", "en")),
      createElement("p", null, formatMoney(figures.subtotal, "EGP", "en")),
      createElement("p", null, formatMoney(figures.discount, "EGP", "en")),
      createElement("p", null, formatMoney(figures.serviceFee, "EGP", "en")),
      createElement("p", null, formatMoney(figures.tax, "EGP", "en")),
      createElement("p", null, formatMoney(orderTotal, "EGP", "en")),
      createElement("p", null, formatMoney(orderTotal, "EGP", "en")),
      createElement("p", null, formatMoney(orderTotal, "EGP", "en")),
    ),
  );

  assert.equal(tile, "65.00");
  assert.equal(line, "90.00");
  assert.equal(orderTotal, "102.60");
  assert.match(html, /102\.60/);
  assert.match(html, /EGP/);
  assert.equal(html.includes("60.00"), false);
  assert.equal(html.includes("115"), false);
});

test("a quote total of 95.20 renders as EGP 95.20", () => {
  const pricing = {
    subtotal: "80.00",
    discount_total: "0.00",
    service_fee_total: "0.00",
    tax_total: "0.00",
    total: "95.20",
  };
  const orderTotal = quotedOrderTotal(pricing);
  const figures = guestQuoteFigures(pricing);
  const html = renderToStaticMarkup(
    createElement("p", null, formatMoney(orderTotal, "EGP", "en")),
  );

  assert.equal(orderTotal, pricing.total);
  assert.equal(figures.total, "95.20");
  assert.equal(orderTotal, "95.20");
  assert.match(html, /EGP\s*95\.20/);
});

test("a quote discount of 10.00 renders as EGP 10.00 and the total stays the quote total", () => {
  const pricing = {
    subtotal: "100.00",
    discount_total: "10.00",
    service_fee_total: "5.00",
    tax_total: "12.60",
    total: "95.20",
  };
  const figures = guestQuoteFigures(pricing);
  const orderTotal = quotedOrderTotal(pricing);
  const html = renderToStaticMarkup(
    createElement("p", null, formatMoney(figures.discount, "EGP", "en")),
  );

  assert.equal(figures.discount, pricing.discount_total);
  assert.equal(figures.serviceFee, pricing.service_fee_total);
  assert.equal(figures.tax, pricing.tax_total);
  assert.equal(figures.subtotal, pricing.subtotal);
  assert.equal(orderTotal, "95.20");
  assert.equal(figures.total, orderTotal);
  assert.match(html, /EGP\s*10\.00/);
});
