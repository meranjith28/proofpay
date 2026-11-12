"use client";
import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

export type JobRow = {
  id: string;
  title: string;
  type: string;
  amount: number;
  status: string;
  statusLabel: string;
  due: string | null;
  overdue: boolean;
  counterpart: string;
  checks: string; // e.g. "3 of 4 passed"
  updated: string; // ISO
};

// Matches the app's colours and type so the grid feels native, not bolted on.
const proofpayTheme = themeQuartz.withParams({
  accentColor: "#2448f5",
  backgroundColor: "#ffffff",
  foregroundColor: "#13213a",
  borderColor: "#d9e0ea",
  headerBackgroundColor: "#f4f6f9",
  headerTextColor: "#5b6b82",
  headerFontWeight: 600,
  fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif",
  fontSize: 14,
  rowHoverColor: "#f4f6f9",
  wrapperBorderRadius: 12,
  rowBorder: { color: "#eef1f5" },
  spacing: 7,
});

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  funding: "bg-held-soft text-held",
  funded: "bg-held-soft text-held",
  in_progress: "bg-held-soft text-held",
  submitted: "bg-blue-50 text-action",
  needs_revision: "bg-danger-soft text-danger",
  disputed: "bg-blue-50 text-action",
  paid: "bg-verified-soft text-verified",
  refunded: "bg-slate-100 text-slate-700",
};

function TitleCell(p: ICellRendererParams<JobRow>) {
  return (
    <a href={`/jobs/${p.data?.id}`} className="font-semibold text-ink underline-offset-4 hover:text-action hover:underline">
      {p.value}
    </a>
  );
}
function StatusCell(p: ICellRendererParams<JobRow>) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[p.data?.status ?? ""] ?? STATUS_STYLE.draft}`}>
      {p.value}
    </span>
  );
}
function DueCell(p: ICellRendererParams<JobRow>) {
  if (!p.value) return <span className="text-muted">No deadline</span>;
  return <span className={p.data?.overdue ? "font-semibold text-danger" : ""}>{p.data?.overdue ? `Overdue ${p.value}` : p.value}</span>;
}

export function JobsGrid({ rows, counterpartLabel, emptyText }: { rows: JobRow[]; counterpartLabel: string; emptyText: string }) {
  const [quick, setQuick] = useState("");
  const cols = useMemo<ColDef<JobRow>[]>(
    () => [
      { field: "title", headerName: "Job", flex: 2.2, minWidth: 200, cellRenderer: TitleCell, tooltipField: "title" },
      { field: "type", headerName: "Type", flex: 1, minWidth: 110, filter: true },
      { field: "amount", headerName: "Amount", flex: 0.8, minWidth: 95, type: "rightAligned", valueFormatter: (p) => `$${Number(p.value).toFixed(2)}` },
      { field: "statusLabel", headerName: "Status", flex: 1.4, minWidth: 150, cellRenderer: StatusCell, filter: true, tooltipField: "statusLabel" },
      { field: "checks", headerName: "Checklist", flex: 1, minWidth: 115 },
      { field: "due", headerName: "Due", flex: 1.1, minWidth: 135, cellRenderer: DueCell },
      { field: "counterpart", headerName: counterpartLabel, flex: 1.4, minWidth: 150, tooltipField: "counterpart" },
      {
        field: "updated",
        headerName: "Updated",
        hide: true, // kept for sorting newest first; hidden to give the other columns room
        sort: "desc",
        valueFormatter: (p) => new Date(p.value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
      },
    ],
    [counterpartLabel],
  );

  if (rows.length === 0) return <p className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-muted">{emptyText}</p>;

  return (
    <div className="space-y-3">
      <input
        value={quick}
        onChange={(e) => setQuick(e.target.value)}
        placeholder="Search your jobs"
        aria-label="Search your jobs"
        className="input max-w-xs"
      />
      <div style={{ height: Math.min(52 + rows.length * 44, 540) }}>
        <AgGridReact<JobRow>
          theme={proofpayTheme}
          rowData={rows}
          columnDefs={cols}
          quickFilterText={quick}
          defaultColDef={{ sortable: true, resizable: true, suppressMovable: true }}
          rowHeight={44}
          headerHeight={48}
          tooltipShowDelay={300}
          getRowId={(p) => p.data.id}
          animateRows
        />
      </div>
    </div>
  );
}
