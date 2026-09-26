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
import { pickLocale } from "@/lib/i18n/locale-text";
import { useWorkspace } from "@/stores/workspace";

type Invitation = components["schemas"]["InvitationResponse"];
type InvitationStatus = Invitation["status"];
type StatusFilter = "all" | "pending" | "accepted" | "expired" | "revoked";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
];

const STATUS_TONE: Record<InvitationStatus, "ordered" | "available" | "neutral" | "soldout"> = {
  PENDING: "ordered",
  ACCEPTED: "available",
  EXPIRED: "neutral",
  REVOKED: "soldout",
};

const STATUS_LABEL: Record<InvitationStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
};

const select = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function inviteErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 403:
        return error.message || "You cannot invite that role or scope.";
      case 409:
        return "This email already has an account.";
      case 502:
        return "The email could not be delivered, so the invitation was not saved. Check the address and try again.";
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function InvitationsScreen({ title }: { title: string }) {
  const me = useStaffSession();
  const queryClient = useQueryClient();
  const workspaceBrandId = useWorkspace((state) => state.brandId);
  const workspaceBranchId = useWorkspace((state) => state.branchId);

  const actorRole = me?.role ?? "CASHIER";
  const roles = invitableRoles(actorRole);
  const isSuper = actorRole === "SUPER_ADMIN";
  const isBranchAdmin = actorRole === "BRANCH_ADMIN";

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>(roles[0] ?? "CASHIER");
  const [brandId, setBrandId] = useState<string>(workspaceBrandId ?? "");
  const [branchId, setBranchId] = useState<string>(workspaceBranchId ?? "");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);

  const branchScoped = isBranchScopedRole(role);

  const brands = useQuery({
    queryKey: ["brands"],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data, response } = await browserApi.GET("/api/v1/brands", { params: { query: { limit: 100 } } });
      if (!response.ok) return [];
      return data?.items ?? [];
    },
  });

  const branches = useQuery({
    queryKey: ["invite-branches"],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data, response } = await browserApi.GET("/api/v1/branches", { params: { query: { limit: 100 } } });
      if (!response.ok || !data) return [];
      return data;
    },
  });

  const branchOptions = useMemo(() => {
    const all = branches.data ?? [];
    const allowed = new Set(me?.allowed_branch_ids ?? []);
    return all.filter((branch) => {
      if (isBranchAdmin && allowed.size > 0 && !allowed.has(branch.id)) return false;
      if (isSuper && brandId) return branch.brand_id === brandId;
      return true;
    });
  }, [branches.data, me?.allowed_branch_ids, isBranchAdmin, isSuper, brandId]);

  const invitations = useQuery({
    queryKey: ["invitations", filter],
    enabled: Boolean(me),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/invitations", {
        params: { query: filter === "all" ? {} : { status: filter } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Could not load invitations");
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
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Could not send the invitation");
      return result.data;
    },
    onSuccess: (invitation) => {
      toast.success(`Invite sent to ${invitation.email}`);
      setEmail("");
      setFullName("");
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (error) => toast.error(inviteErrorMessage(error)),
  });

  const resend = useMutation({
    mutationFn: async (invitation: Invitation) => {
      const result = await browserApi.POST("/api/v1/invitations/{invitation_id}/resend", {
        params: { path: { invitation_id: invitation.id } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not resend");
      return invitation;
    },
    onSuccess: (invitation) => {
      toast.success(`New link sent to ${invitation.email}`);
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (error) => toast.error(inviteErrorMessage(error)),
  });

  const revoke = useMutation({
    mutationFn: async (invitation: Invitation) => {
      const result = await browserApi.POST("/api/v1/invitations/{invitation_id}/revoke", {
        params: { path: { invitation_id: invitation.id } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not revoke");
      return invitation;
    },
    onSuccess: (invitation) => {
      toast.success(`Invitation for ${invitation.email} revoked`);
      setRevokeTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (error) => toast.error(inviteErrorMessage(error)),
  });

  if (!me) return null;

  const brandName = (id: string | null | undefined) =>
    (brands.data ?? []).find((brand) => brand.id === id)?.name ?? null;
  const branchName = (id: string | null | undefined) => {
    const branch = (branches.data ?? []).find((item) => item.id === id);
    if (!branch) return null;
    return branch.display_name || pickLocale(branch.name, "en") || "Branch";
  };

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
        <p className="mt-1 text-sm text-muted-foreground">
          Invite people by email. They open the link, set their own password, and land in the right screen for their role.
        </p>
      </header>

      {noBrandsYet ? (
        <EmptyState
          title="Create a brand first"
          body="Every invitation belongs to a brand. Add the brand, then come back here and invite its brand admin."
          action={
            <Link href="/app/brands" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
              Go to Brands
            </Link>
          }
        />
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border bg-card p-4 shadow-elev-1">
          <h2 className="text-[length:var(--text-20)] font-semibold">Send an invitation</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11"
                placeholder="person@restaurant.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-role">Role</Label>
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
                <Label htmlFor="invite-brand">Brand</Label>
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
                  <option value="">{brands.isFetching ? "Loading brands…" : "Choose a brand"}</option>
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
                <Label htmlFor="invite-branch">Branch</Label>
                <select id="invite-branch" className={select} required value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                  <option value="">
                    {branches.isFetching ? "Loading branches…" : branchOptions.length === 0 ? "No branches yet" : "Choose a branch"}
                  </option>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.display_name || pickLocale(branch.name, "en") || "Branch"}
                    </option>
                  ))}
                </select>
                {isSuper && brandId && branches.isSuccess && branchOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    This brand has no branches.{" "}
                    <Link href={`/app/brands/${brandId}`} className="underline">
                      Add one
                    </Link>{" "}
                    before inviting {roleLabel(role).toLowerCase()} staff.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="invite-name">Full name (optional)</Label>
              <Input id="invite-name" autoComplete="off" value={fullName} onChange={(event) => setFullName(event.target.value)} className="h-11" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="min-h-11 px-5" disabled={!canSubmit}>
              {create.isPending ? "Sending…" : "Send invite"}
            </Button>
            <p className="text-xs text-muted-foreground">The link in the email expires after a few days. You can resend it from the list below.</p>
          </div>
        </form>
      )}

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[length:var(--text-20)] font-semibold">Invitations</h2>
          <div role="tablist" aria-label="Filter invitations" className="flex flex-wrap gap-1">
            {FILTERS.map((item) => {
              const active = item.value === filter;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(item.value)}
                  className={`min-h-9 rounded-full px-3 text-sm ${active ? "bg-secondary font-medium" : "hover:bg-muted"}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {invitations.isLoading ? <LoadingState label="Loading invitations" /> : null}
        {invitations.isError ? (
          <ErrorState body={invitations.error.message} onRetry={() => void invitations.refetch()} />
        ) : null}
        {invitations.isSuccess && invitations.data.length === 0 ? (
          <EmptyState
            title={filter === "all" ? "No invitations yet" : `No ${filter} invitations`}
            body={filter === "all" ? "People you invite show up here with their status." : "Change the filter to see other invitations."}
          />
        ) : null}
        {invitations.isSuccess && invitations.data.length > 0 ? (
          <ul className="grid gap-2">
            {invitations.data.map((invitation) => {
              const scope = [brandName(invitation.brand_id), branchName(invitation.branch_id)].filter(Boolean).join(" · ");
              const pending = invitation.status === "PENDING";
              const when =
                invitation.status === "ACCEPTED"
                  ? `Accepted ${formatDate(invitation.accepted_at)}`
                  : invitation.status === "REVOKED"
                    ? `Revoked ${formatDate(invitation.revoked_at)}`
                    : `Expires ${formatDate(invitation.expires_at)}`;
              return (
                <li key={invitation.id} className="grid gap-3 rounded-xl border bg-card p-4 shadow-elev-1 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium break-all">{invitation.email}</p>
                      <StatusChip tone={STATUS_TONE[invitation.status]}>{STATUS_LABEL[invitation.status]}</StatusChip>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[invitation.full_name, roleLabel(invitation.role), scope].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {when}
                      {invitation.send_count > 1 ? ` · Sent ${invitation.send_count} times` : ""}
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
                        {resend.isPending && resend.variables?.id === invitation.id ? "Sending…" : "Resend"}
                      </Button>
                      <Button type="button" variant="destructive" className="min-h-11 px-4" onClick={() => setRevokeTarget(invitation)}>
                        Revoke
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
        title="Revoke this invitation?"
        description={`${revokeTarget?.email ?? "This person"} will no longer be able to use the link. You can send a new invitation later.`}
        confirmLabel="Revoke"
        destructive
        pending={revoke.isPending}
        onConfirm={() => revokeTarget && revoke.mutate(revokeTarget)}
      />
    </div>
  );
}
