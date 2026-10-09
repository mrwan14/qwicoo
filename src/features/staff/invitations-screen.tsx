"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { useStaffSession } from "@/components/ops/staff-session";
import { EmptyState, ErrorState, LoadingState } from "@/components/ops/states";
import { StatusChip } from "@/components/ops/status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { browserApi } from "@/lib/api/browser";
import { ApiError, asApiError } from "@/lib/api/error";
import type { components } from "@/lib/api/schema";
import { invitableRoles, isBranchScopedRole, roleLabel, type UserRole } from "@/lib/auth/roles";
import { fill } from "@/lib/i18n/dictionary";
import { formatCairoDateTime } from "@/lib/format/time";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { commonCopy } from "@/lib/i18n/staff/common";
import { peopleCopy } from "@/lib/i18n/staff/people";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

type Invitation = components["schemas"]["InvitationResponse"];
type InvitationStatus = Invitation["status"];
type StatusFilter = "all" | "pending" | "accepted" | "expired" | "revoked";

const FILTERS: StatusFilter[] = ["all", "pending", "accepted", "expired", "revoked"];

const STATUS_TONE: Record<InvitationStatus, "ordered" | "available" | "neutral" | "soldout"> = {
  PENDING: "ordered",
  ACCEPTED: "available",
  EXPIRED: "neutral",
  REVOKED: "soldout",
};

const select = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm";

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  return formatCairoDateTime(iso, locale);
}

function inviteErrorMessage(error: unknown, copy: (typeof peopleCopy)["en"]["invitations"]): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 403:
        return error.message || copy.cannotInvite;
      case 409:
        return copy.emailTaken;
      case 502:
        return copy.emailNotDelivered;
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : copy.somethingWrong;
}

export function InvitationsScreen({ title }: { title: string }) {
  const t = useStaffSection(peopleCopy).invitations;
  const common = useStaffSection(commonCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const queryClient = useQueryClient();
  const isSuper = useScope((state) => state.homeScope === "platform");
  const scopeBrandId = useScope((state) => state.brandId);
  const scopeBranchId = useScope((state) => state.branchId);
  const scopeBranches = useScope((state) => state.branches);

  const actorRole = me?.role ?? "CASHIER";
  const roles = invitableRoles(actorRole);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>(roles[0] ?? "CASHIER");
  const [brandId, setBrandId] = useState<string>(isSuper ? (scopeBrandId ?? "") : "");
  const [branchId, setBranchId] = useState<string>(scopeBranchId ?? "");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);

  const branchScoped = isBranchScopedRole(role);

  // App Admin only: the all-brands list, then the chosen brand's branches.
  const brands = useQuery({
    queryKey: ["brands"],
    enabled: isSuper,
    queryFn: async () => {
      const { data, response } = await browserApi.GET("/api/v1/brands", { params: { query: { limit: 100 } } });
      if (!response.ok) return [];
      return data?.items ?? [];
    },
  });

  const brandBranches = useQuery({
    queryKey: ["brand-branches", brandId],
    enabled: isSuper && Boolean(brandId),
    queryFn: async () => {
      const { data, response } = await browserApi.GET("/api/v1/brands/{brand_id}/branches", {
        params: { path: { brand_id: brandId } },
      });
      if (!response.ok || !data) return [];
      return data;
    },
  });

  // Everyone else invites only into branches `/auth/me` says they can reach.
  const branchOptions = useMemo(() => {
    if (!isSuper) return scopeBranches;
    return (brandBranches.data ?? []).map((branch) => ({
      id: branch.id,
      name: pickLocale(branch.name, locale) || branch.slug,
    }));
  }, [isSuper, scopeBranches, brandBranches.data, locale]);
  const branchesLoading = isSuper && brandBranches.isFetching;

  const invitations = useQuery({
    queryKey: ["invitations", filter],
    enabled: Boolean(me),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/invitations", {
        params: { query: filter === "all" ? {} : { status: filter } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
      return result.data.records;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["InvitationCreateRequest"] = {
        email: email.trim(),
        role,
        ...(isSuper && brandId ? { brand_id: brandId } : {}),
        ...(branchScoped && branchId ? { branch_id: branchId } : {}),
        ...(fullName.trim() ? { full_name: fullName.trim() } : {}),
      };
      const result = await browserApi.POST("/api/v1/invitations", { body });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.sendFailed);
      return result.data;
    },
    onSuccess: (invitation) => {
      toast.success(fill(t.sent, { email: invitation.email }));
      setEmail("");
      setFullName("");
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (error) => toast.error(inviteErrorMessage(error, t)),
  });

  const resend = useMutation({
    mutationFn: async (invitation: Invitation) => {
      const result = await browserApi.POST("/api/v1/invitations/{invitation_id}/resend", {
        params: { path: { invitation_id: invitation.id } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.resendFailed);
      return invitation;
    },
    onSuccess: (invitation) => {
      toast.success(fill(t.resent, { email: invitation.email }));
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (error) => toast.error(inviteErrorMessage(error, t)),
  });

  const revoke = useMutation({
    mutationFn: async (invitation: Invitation) => {
      const result = await browserApi.POST("/api/v1/invitations/{invitation_id}/revoke", {
        params: { path: { invitation_id: invitation.id } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.revokeFailed);
      return invitation;
    },
    onSuccess: (invitation) => {
      toast.success(fill(t.revoked, { email: invitation.email }));
      setRevokeTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (error) => toast.error(inviteErrorMessage(error, t)),
  });

  if (!me) return null;

  const brandName = (id: string | null | undefined) => {
    if (!id) return null;
    if (!isSuper) return id === me.brand_id ? (me.brand_name ?? null) : null;
    return (brands.data ?? []).find((brand) => brand.id === id)?.name ?? null;
  };
  const branchName = (id: string | null | undefined) => branchOptions.find((item) => item.id === id)?.name ?? null;

  const noBrandsYet = isSuper && brands.isSuccess && brands.data.length === 0;
  const missingBrand = isSuper && !brandId;
  const missingBranch = branchScoped && !branchId;
  const canSubmit = !create.isPending && !missingBrand && !missingBranch && email.trim().length > 0;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    create.mutate();
  }

  function onRoleChange(next: UserRole) {
    setRole(next);
    if (!isBranchScopedRole(next)) setBranchId("");
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <header>
        <h1 className="text-[length:var(--text-28)] font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.intro}</p>
      </header>

      {noBrandsYet ? (
        <EmptyState
          title={t.createBrandTitle}
          body={t.createBrandBody}
          action={
            <Link href="/app/brands" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
              {common.goToBrands}
            </Link>
          }
        />
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border bg-card p-4 shadow-elev-1">
          <h2 className="text-[length:var(--text-20)] font-semibold">{t.sendTitle}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="invite-email">{t.email}</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11"
                placeholder={t.emailPlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-role">{t.role}</Label>
              <select id="invite-role" className={select} value={role} onChange={(event) => onRoleChange(event.target.value as UserRole)}>
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {roleLabel(item)}
                  </option>
                ))}
              </select>
            </div>
            {isSuper ? (
              <div className="grid gap-2">
                <Label htmlFor="invite-brand">{t.brand}</Label>
                <select
                  id="invite-brand"
                  className={select}
                  required
                  value={brandId}
                  onChange={(event) => {
                    setBrandId(event.target.value);
                    setBranchId("");
                  }}
                >
                  <option value="">{brands.isFetching ? t.loadingBrands : t.chooseBrand}</option>
                  {(brands.data ?? []).map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {branchScoped ? (
              <div className="grid gap-2">
                <Label htmlFor="invite-branch">{t.branch}</Label>
                <select id="invite-branch" className={select} required value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                  <option value="">
                    {branchesLoading ? t.loadingBranches : branchOptions.length === 0 ? t.noBranchesYet : t.chooseBranch}
                  </option>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                {isSuper && brandId && brandBranches.isSuccess && branchOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t.noBranches}{" "}
                    <Link href={`/app/brands/${brandId}`} className="underline">
                      {common.addOne}
                    </Link>{" "}
                    {fill(t.beforeInviting, { role: locale === "en" ? roleLabel(role).toLowerCase() : roleLabel(role) })}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="invite-name">{t.fullName}</Label>
              <Input id="invite-name" autoComplete="off" value={fullName} onChange={(event) => setFullName(event.target.value)} className="h-11" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="min-h-11 px-5" disabled={!canSubmit}>
              {create.isPending ? t.sending : t.send}
            </Button>
            <p className="text-xs text-muted-foreground">{t.linkHint}</p>
          </div>
        </form>
      )}

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[length:var(--text-20)] font-semibold">{t.listTitle}</h2>
          <div role="tablist" aria-label={t.filterAria} className="flex flex-wrap gap-1">
            {FILTERS.map((item) => {
              const active = item === filter;
              return (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(item)}
                  className={`min-h-9 rounded-full px-3 text-sm ${active ? "bg-secondary font-medium" : "hover:bg-muted"}`}
                >
                  {t.filters[item]}
                </button>
              );
            })}
          </div>
        </div>

        {invitations.isLoading ? <LoadingState label={t.loading} /> : null}
        {invitations.isError ? (
          <ErrorState body={invitations.error.message} onRetry={() => void invitations.refetch()} />
        ) : null}
        {invitations.isSuccess && invitations.data.length === 0 ? (
          <EmptyState
            title={filter === "all" ? t.emptyAllTitle : fill(t.emptyFilteredTitle, { status: locale === "en" ? t.filters[filter].toLowerCase() : t.filters[filter] })}
            body={filter === "all" ? t.emptyAllBody : t.emptyFilteredBody}
          />
        ) : null}
        {invitations.isSuccess && invitations.data.length > 0 ? (
          <ul className="grid gap-2">
            {invitations.data.map((invitation) => {
              const scope = [brandName(invitation.brand_id), branchName(invitation.branch_id)].filter(Boolean).join(" · ");
              const pending = invitation.status === "PENDING";
              const when =
                invitation.status === "ACCEPTED"
                  ? fill(t.acceptedWhen, { when: formatDate(invitation.accepted_at, locale) })
                  : invitation.status === "REVOKED"
                    ? fill(t.revokedWhen, { when: formatDate(invitation.revoked_at, locale) })
                    : fill(t.expiresWhen, { when: formatDate(invitation.expires_at, locale) });
              return (
                <li key={invitation.id} className="grid gap-3 rounded-xl border bg-card p-4 shadow-elev-1 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium break-all">{invitation.email}</p>
                      <StatusChip tone={STATUS_TONE[invitation.status]}>{t.status[invitation.status]}</StatusChip>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[invitation.full_name, roleLabel(invitation.role), scope].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {when}
                      {invitation.send_count > 1 ? fill(t.sentTimes, { count: invitation.send_count }) : ""}
                    </p>
                  </div>
                  {pending ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 px-4"
                        disabled={resend.isPending && resend.variables?.id === invitation.id}
                        onClick={() => resend.mutate(invitation)}
                      >
                        {resend.isPending && resend.variables?.id === invitation.id ? t.sending : t.resend}
                      </Button>
                      <Button type="button" variant="destructive" className="min-h-11 px-4" onClick={() => setRevokeTarget(invitation)}>
                        {t.revoke}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title={t.revokeTitle}
        description={fill(t.revokeBody, { who: revokeTarget?.email ?? t.thisPerson })}
        confirmLabel={t.revoke}
        destructive
        pending={revoke.isPending}
        onConfirm={() => revokeTarget && revoke.mutate(revokeTarget)}
      />
    </div>
  );
}
