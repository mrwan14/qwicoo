"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { StatusChip } from "@/components/ops/status-chip";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { UserRole } from "@/lib/auth/roles";
import { useLocale } from "@/lib/i18n/locale-store";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import type { components } from "@/lib/api/schema";
import { mediaUrl, presignedUploadUrl } from "@/lib/media";
import {
  isRetailType,
  readSessionStoreItems,
  storeStockView,
  writeSessionStoreItems,
  type SessionStoreItem,
} from "@/features/staff/store";

const field = "h-11 w-full border bg-background px-3 text-sm";
const button = "min-h-11 border bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50";

type StockRow = { onHand: string | null; held: string };

function canEditStructure(role: UserRole | null | undefined, brandWide: boolean): boolean {
  if (role === "SUPER_ADMIN" || role === "BRAND_ADMIN") return true;
  if (role === "BRANCH_ADMIN") return !brandWide;
  return false;
}

function canEditStock(role: UserRole | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "BRAND_ADMIN" || role === "BRANCH_ADMIN";
}

async function uploadImage(file: File, failed: string): Promise<string> {
  const body: components["schemas"]["PresignedUrlRequest"] = {
    filename: file.name || "image.png",
    content_type: file.type || "image/png",
    folder: "items",
  };
  const signed = await browserApi.POST("/api/v1/media/presigned-url", { body });
  if (!signed.response.ok || !signed.data) throw asApiError(signed.error, signed.response, failed);
  const uploaded = await fetch(presignedUploadUrl(signed.data.upload_url), {
    method: "PUT",
    body: file,
    headers: { "content-type": file.type || "image/png" },
  });
  if (!uploaded.ok) throw new Error(failed);
  return signed.data.public_url;
}

function fromResponse(item: components["schemas"]["StaffItemResponse"], brandWide: boolean): SessionStoreItem {
  return {
    id: item.id,
    nameEn: item.name.en ?? "",
    nameAr: item.name.ar ?? "",
    descriptionEn: item.description?.en ?? "",
    descriptionAr: item.description?.ar ?? "",
    price: item.base_price,
    available: item.is_available,
    maxPerOrder: item.max_per_order ?? null,
    imageUrl: item.image_url ?? null,
    categoryId: item.category_id,
    brandWide,
  };
}

export function StoreTab({
  branchId,
  role,
  categories,
  treeItems,
}: {
  branchId: string;
  role: UserRole | null | undefined;
  categories: { id: string; name: string }[];
  treeItems: { id: string; name: string; item_type?: string | null; scope?: string | null }[];
}) {
  const t = useStaffSection(menuCopy);
  const { locale } = useLocale();
  const [items, setItems] = useState<SessionStoreItem[]>(() => readSessionStoreItems());
  const [stock, setStock] = useState<Record<string, StockRow>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [price, setPrice] = useState("10.00");
  const [maxPerOrder, setMaxPerOrder] = useState("");
  const [available, setAvailable] = useState(true);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [image, setImage] = useState<File | null>(null);
  const [brandWide, setBrandWide] = useState(role === "SUPER_ADMIN" || role === "BRAND_ADMIN");

  function remember(next: SessionStoreItem[]) {
    writeSessionStoreItems(next);
    setItems(next);
  }

  const save = useMutation({
    mutationFn: async () => {
      const imageUrl = image ? await uploadImage(image, t.imageUpload) : null;
      const max = maxPerOrder.trim() ? Number(maxPerOrder) : null;
      const description = descriptionEn || descriptionAr ? { en: descriptionEn, ar: descriptionAr } : null;
      if (editing) {
        const result = await browserApi.PATCH("/api/v1/staff/menu/items/{item_id}", {
          params: { path: { item_id: editing } },
          body: {
            name: { en: nameEn, ar: nameAr },
            description,
            base_price: price,
            is_available: available,
            max_per_order: max,
            item_type: "RETAIL",
            ...(imageUrl ? { image_url: imageUrl } : {}),
          },
        });
        if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.storeFailed);
        return fromResponse(result.data, brandWide);
      }
      const result = await browserApi.POST("/api/v1/staff/menu/items", {
        body: {
          category_id: categoryId,
          name: { en: nameEn, ar: nameAr },
          description,
          base_price: price,
          is_available: available,
          item_type: "RETAIL",
          max_per_order: max,
          ...(imageUrl ? { image_url: imageUrl } : {}),
        },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.storeFailed);
      return fromResponse(result.data, brandWide && (role === "SUPER_ADMIN" || role === "BRAND_ADMIN"));
    },
    onSuccess: (saved) => {
      const rest = items.filter((item) => item.id !== saved.id);
      remember([saved, ...rest]);
      setOpen(false);
      setEditing(null);
      toast.success(t.storeSaved);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setShelf = useMutation({
    mutationFn: async (input: { itemId: string; quantity: string; held: number }) => {
      const quantity = Number(input.quantity);
      if (Number.isFinite(input.held) && quantity < input.held) throw new Error(t.stockBelowHeld);
      const result = await browserApi.PATCH("/api/v1/staff/menu/items/{item_id}/branches/{branch_id}/stock", {
        params: { path: { item_id: input.itemId, branch_id: branchId } },
        body: { stock_quantity: input.quantity },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.stockFailed);
      return result.data;
    },
    onSuccess: (data) => {
      setStock((current) => ({
        ...current,
        [data.item_id]: { onHand: data.stock_quantity, held: data.reserved_quantity },
      }));
      toast.success(t.stockSaved);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const override = useMutation({
    mutationFn: async (input: { itemId: string; price: string; available: boolean }) => {
      const result = await browserApi.PATCH("/api/v1/menu/branches/{branch_id}/items/{item_id}/override", {
        params: { path: { branch_id: branchId, item_id: input.itemId } },
        body: { price_override: input.price, is_available: input.available },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.overrideFailed);
    },
    onSuccess: () => toast.success(t.overrideSaved),
    onError: (error: Error) => toast.error(error.message),
  });

  const listed = [
    ...items,
    ...treeItems.filter((item) => isRetailType(item.item_type) && !items.some((saved) => saved.id === item.id)).map((item) => ({
      id: item.id,
      nameEn: item.name,
      nameAr: item.name,
      descriptionEn: "",
      descriptionAr: "",
      price: "",
      available: true,
      maxPerOrder: null,
      imageUrl: null,
      categoryId: "",
      brandWide: item.scope === "ALL_BRANCHES",
    })),
  ];

  function startCreate() {
    setEditing(null);
    setNameEn("");
    setNameAr("");
    setDescriptionEn("");
    setDescriptionAr("");
    setPrice("10.00");
    setMaxPerOrder("");
    setAvailable(true);
    setCategoryId(categories[0]?.id ?? "");
    setImage(null);
    setBrandWide(role === "SUPER_ADMIN" || role === "BRAND_ADMIN");
    setOpen(true);
  }

  function startEdit(item: SessionStoreItem) {
    setEditing(item.id);
    setNameEn(item.nameEn);
    setNameAr(item.nameAr);
    setDescriptionEn(item.descriptionEn);
    setDescriptionAr(item.descriptionAr);
    setPrice(item.price);
    setMaxPerOrder(item.maxPerOrder == null ? "" : String(item.maxPerOrder));
    setAvailable(item.available);
    setCategoryId(item.categoryId);
    setImage(null);
    setBrandWide(item.brandWide);
    setOpen(true);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t.storeHint}</p>
        <div className="flex gap-2">
          <Link href="/app/inventory/recipes" className="inline-flex min-h-11 items-center border px-4 text-sm">{t.recipes}</Link>
          {canEditStructure(role, false) ? (
            <button type="button" className={button} onClick={startCreate}>{t.addStoreItem}</button>
          ) : null}
        </div>
      </div>
      {open ? (
        <form
          className="grid max-w-xl gap-3 border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label className="grid gap-1 text-sm">{t.englishName}<input className={field} value={nameEn} onChange={(event) => setNameEn(event.target.value)} required /></label>
          <label className="grid gap-1 text-sm">{t.arabicName}<input className={field} value={nameAr} onChange={(event) => setNameAr(event.target.value)} required /></label>
          <label className="grid gap-1 text-sm">{t.descriptionEn}<textarea className="min-h-20 border bg-background px-3 py-2 text-sm" value={descriptionEn} onChange={(event) => setDescriptionEn(event.target.value)} /></label>
          <label className="grid gap-1 text-sm">{t.descriptionAr}<textarea className="min-h-20 border bg-background px-3 py-2 text-sm" value={descriptionAr} onChange={(event) => setDescriptionAr(event.target.value)} /></label>
          {!editing ? (
            <label className="grid gap-1 text-sm">
              {t.category}
              <select className={field} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1 text-sm">{t.priceEgp}<input className={field} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required /></label>
          <label className="grid gap-1 text-sm">
            {t.maxPerOrder}
            <span className="text-sm text-muted-foreground">{t.maxPerOrderHint}</span>
            <input className={field} inputMode="numeric" value={maxPerOrder} onChange={(event) => setMaxPerOrder(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">{t.image}<input className={field} type="file" accept="image/*" onChange={(event) => setImage(event.target.files?.[0] ?? null)} /></label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} />
            {t.availableLabel}
          </label>
          <button type="submit" className={button} disabled={save.isPending || (!editing && !categoryId)}>{save.isPending ? t.creating : t.storeSaved}</button>
        </form>
      ) : null}
      {listed.length === 0 ? <p className="text-sm text-muted-foreground">{t.storeEmpty}</p> : (
        <ul className="grid gap-3">
          {listed.map((item) => {
            const shelf = stock[item.id];
            const onHand = shelf?.onHand == null ? null : Number(shelf.onHand);
            const held = shelf ? Number(shelf.held) : null;
            const view = onHand != null && held != null && Number.isFinite(onHand) && Number.isFinite(held) ? storeStockView(onHand, held) : null;
            const name = locale === "ar" ? item.nameAr || item.nameEn : item.nameEn;
            const editable = canEditStructure(role, item.brandWide);
            return (
              <li key={item.id} className="grid gap-3 border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <h2 className="font-medium">{name}</h2>
                    {item.price ? <p className="text-sm tabular-nums"><Money amount={item.price} /></p> : null}
                    {item.brandWide && role === "BRANCH_ADMIN" ? <p className="text-sm text-muted-foreground">{t.readOnlyBrand}</p> : null}
                  </div>
                    {item.imageUrl ? (
                      // Stored photos are on the upload host, which next/image is not set up to optimise.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(item.imageUrl) ?? item.imageUrl} alt="" className="size-16 object-cover" />
                    ) : null}
                </div>
                {view ? (
                  <p className="flex flex-wrap items-center gap-2 text-sm tabular-nums">
                    <span>{t.onHand} {onHand}</span>
                    <span>{t.held} {held}</span>
                    <span>{t.availableCount} {view.available}</span>
                    {view.badge === "low" ? <StatusChip tone="ordered">{t.low}</StatusChip> : null}
                    {view.badge === "out" ? <StatusChip tone="soldout">{t.out}</StatusChip> : null}
                  </p>
                ) : <p className="text-sm text-muted-foreground">{t.notTracked}</p>}
                {editable ? (
                  <button type="button" className="min-h-11 w-fit border px-3 text-sm" onClick={() => startEdit(item)}>{t.changePrice}</button>
                ) : null}
                {canEditStock(role) ? (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      setShelf.mutate({ itemId: item.id, quantity: String(data.get("stock") ?? ""), held: held ?? 0 });
                    }}
                  >
                    <label className="grid gap-1 text-sm">
                      {t.onHand}
                      <input name="stock" className={field} inputMode="decimal" defaultValue={shelf?.onHand ?? ""} />
                    </label>
                    <button type="submit" className="min-h-11 border px-3 text-sm" disabled={setShelf.isPending}>{t.saveStock}</button>
                  </form>
                ) : null}
                {canEditStock(role) ? (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      override.mutate({
                        itemId: item.id,
                        price: String(data.get("price") ?? item.price),
                        available: data.get("available") === "on",
                      });
                    }}
                  >
                    <label className="grid gap-1 text-sm">
                      {t.branchPrice}
                      <input name="price" className={field} inputMode="decimal" defaultValue={item.price} />
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input name="available" type="checkbox" defaultChecked={item.available} />
                      {t.availableLabel}
                    </label>
                    <button type="submit" className="min-h-11 border px-3 text-sm" disabled={override.isPending}>{t.saveBranch}</button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
