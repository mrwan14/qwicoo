"use client";

import { Package, Plus, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Badge, StatusDot } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { Card, KpiCard, SectionLabel } from "@/components/ops/kit/card";
import { ConfirmDialog } from "@/components/ops/kit/confirm-dialog";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { dateFilter, type DateFilter } from "@/components/ops/kit/date-range";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { Field, Input, Select, Switch } from "@/components/ops/kit/field";
import { FilterBar } from "@/components/ops/kit/filter-bar";
import { PageHeader } from "@/components/ops/kit/page-header";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { MoreOptions, PanelSection, SidePanel } from "@/components/ops/kit/side-panel";
import { Tabs } from "@/components/ops/kit/tabs";
import { StaffTheme } from "@/components/ops/kit/theme";
import { LocaleSwitch } from "@/lib/i18n/locale-switch";

type Order = { id: string; place: string; total: string; status: ReactNode };

const ORDERS: Order[] = [
  { id: "#1042", place: "Table 4", total: "EGP 385", status: <Badge tone="success">Paid</Badge> },
  { id: "#1043", place: "Takeaway", total: "EGP 120", status: <Badge tone="warning">Preparing</Badge> },
  { id: "#1044", place: "Table 9", total: "EGP 640", status: <Badge tone="danger">Waiting 18 min</Badge> },
];

const COLUMNS: Column<Order>[] = [
  { key: "order", header: "Order", cell: (row) => row.id, strong: true },
  { key: "table", header: "Table", cell: (row) => row.place },
  { key: "total", header: "Total", cell: (row) => row.total },
  { key: "status", header: "Status", cell: (row) => row.status },
];

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </section>
  );
}

/** Development-only living copy of the Component sheet frame in qwicoo-dashboard.pen. */
export function KitPreview() {
  const [tab, setTab] = useState("live");
  const [view, setView] = useState<"list" | "tables">("list");
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateFilter>(() => dateFilter("yesterday"));
  const [listRange, setListRange] = useState<DateFilter>(() => dateFilter("today"));
  const [branch, setBranch] = useState("maadi");
  const [drawer, setDrawer] = useState("all");
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState<string | null>("#1043");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <StaffTheme className="min-h-dvh">
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-10 p-4 sm:p-6">
        <PageHeader
          back={{ href: "/dev/kit", label: "Reports · Staff & shifts" }}
          title="Component sheet"
          subtitle="Staff dashboard kit · development preview"
          actions={<LocaleSwitch className="min-h-[42px] rounded-staff border border-border px-4 text-sm hover:bg-subtle" />}
        />

        <Group label="Buttons">
          <div className="flex flex-wrap items-center gap-4">
            <Button>Button</Button>
            <Button variant="secondary">Button</Button>
            <Button variant="danger">Button</Button>
            <Button variant="secondary" size="sm">
              Small
            </Button>
            <Button>
              <Plus aria-hidden />
              New order
            </Button>
            <Button variant="dangerGhost">Cancel order</Button>
            <Button disabled>Disabled</Button>
            <Button size="touch">Touch 56px</Button>
          </div>
        </Group>

        <Group label="Badges and status dots">
          <div className="flex flex-wrap items-center gap-4">
            <Badge tone="warning">Warning</Badge>
            <Badge tone="danger">Danger</Badge>
            <Badge tone="info">Info</Badge>
            <Badge tone="success">Success</Badge>
            <Badge>Neutral</Badge>
            <StatusDot tone="warning">Oat milk is low</StatusDot>
            <StatusDot tone="danger">Order waiting 18 min</StatusDot>
            <StatusDot tone="info">Table 4 called a waiter</StatusDot>
            <StatusDot tone="success">Paid</StatusDot>
          </div>
        </Group>

        <Group label="Inputs">
          <div className="flex flex-wrap items-center gap-4">
            <Input placeholder="Placeholder" className="w-[280px]" />
            <Select className="w-[180px]" defaultValue="all">
              <option value="all">All branches</option>
              <option value="maadi">Maadi</option>
            </Select>
            <Input icon={Search} placeholder="Search orders" className="w-[280px]" />
            <Input defaultValue="Flat white" className="w-[280px]" />
            <Switch checked={on} onCheckedChange={setOn} aria-label="Available" />
            <Switch checked={off} onCheckedChange={setOff} aria-label="Available" />
          </div>
        </Group>

        <Group label="Tabs, KPI card, filter bar">
          <div className="flex flex-wrap items-end gap-4">
            <Tabs
              label="Orders"
              value={tab}
              onValueChange={setTab}
              className="min-w-72 flex-1"
              items={[
                { value: "live", label: "Live", count: 14 },
                { value: "delivery", label: "Delivery", count: 3 },
                { value: "history", label: "History" },
                { value: "payments", label: "Payments" },
              ]}
            />
            <SegmentedControl
              label="View"
              value={view}
              onValueChange={setView}
              items={[
                { value: "list", label: "List" },
                { value: "tables", label: "Tables" },
              ]}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Net sales today" value="EGP 18,450" note="+12% vs last Monday" />
            <KpiCard label="Counted cash" value="EGP 12,430" note="Counted at close" />
            <KpiCard label="Difference" value="−EGP 50" note="1 drawer short" />
            <KpiCard label="Drawers closed" value="3 of 3" loading />
          </div>
          <FilterBar
            search={{ value: search, onChange: setSearch, placeholder: "Search by order, table or guest" }}
            date={{ value: listRange, onChange: setListRange, variant: "select" }}
            dropdowns={[
              {
                label: "Type",
                value: type,
                onChange: setType,
                options: [
                  { value: "all", label: "All types" },
                  { value: "dine_in", label: "Dine in" },
                ],
              },
              {
                label: "Status",
                value: "all",
                onChange: () => undefined,
                options: [{ value: "all", label: "All statuses" }],
              },
            ]}
            onApply={() => toast.success(`Applied ${listRange.from} → ${listRange.to}`)}
          />
          <FilterBar
            date={{ value: range, onChange: setRange }}
            branch={{
              label: "Branch",
              value: branch,
              onChange: setBranch,
              options: [
                { value: "maadi", label: "Maadi" },
                { value: "zamalek", label: "Zamalek" },
              ],
            }}
            dropdowns={[
              {
                label: "Drawer",
                value: drawer,
                onChange: setDrawer,
                options: [{ value: "all", label: "All drawers" }],
              },
            ]}
            onApply={() => toast.success(`Applied ${range.from} → ${range.to}`)}
            onExport={() => toast.success("Export started")}
          />
        </Group>

        <Group label="Table and card">
          <div className="grid items-start gap-6 lg:grid-cols-[620px_320px]">
            <DataTable
              caption="Orders"
              columns={COLUMNS}
              rows={ORDERS}
              rowKey={(row) => row.id}
              selectedKey={selected}
              onRowClick={(row) => setSelected(row.id)}
            />
            <Card title="Card title" description="Short supporting text goes here, one or two lines at most." />
          </div>
          <DataTable caption="Empty" columns={COLUMNS} rows={[]} rowKey={(row) => row.id} />
        </Group>

        <Group label="Feedback">
          <div className="flex flex-wrap items-start gap-6">
            <EmptyState
              className="w-full max-w-[360px]"
              icon={Package}
              title="No suppliers yet"
              body="Add your first supplier to start buying stock."
              action={
                <Button onClick={() => setPanelOpen(true)}>
                  <Plus aria-hidden />
                  Add supplier
                </Button>
              }
            />
            <div className="grid gap-3">
              <Button variant="secondary" onClick={() => toast.success("Item saved")}>
                Show toast
              </Button>
              <Button variant="secondary" onClick={() => toast.error("Couldn't save. Try again.")}>
                Show error toast
              </Button>
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                Delete…
              </Button>
              <Button variant="secondary" onClick={() => setPanelOpen(true)}>
                Open side panel
              </Button>
            </div>
          </div>
        </Group>
      </main>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete “Oat milk”?"
        body="This removes it from all recipes. You can’t undo this."
        onConfirm={() => {
          setConfirmOpen(false);
          toast.success("Oat milk deleted");
        }}
      />

      <SidePanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title="Add supplier"
        meta={<Badge tone="info">New</Badge>}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setPanelOpen(false);
                toast.success("Supplier saved");
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Name">
          <Input defaultValue="Nile Dairy" />
        </Field>
        <Field label="Phone" hint="Used for purchase orders">
          <Input type="tel" defaultValue="010 1234 5678" />
        </Field>
        <PanelSection title="Per branch" hint="Leave price empty to use EGP 110">
          <div className="flex items-center gap-3">
            <span className="flex-1">Maadi</span>
            <Input placeholder="110" className="w-[110px]" aria-label="Maadi price" />
            <Switch checked={on} onCheckedChange={setOn} aria-label="Maadi available" />
          </div>
        </PanelSection>
        <MoreOptions summary="Notes, tax number, payment terms">
          <Field label="Notes">
            <Input />
          </Field>
        </MoreOptions>
      </SidePanel>
    </StaffTheme>
  );
}
