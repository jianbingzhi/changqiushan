"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable,
  sortableKeyboardCoordinates, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { StatusChip } from "@/lib/ui/status-chip";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { StatusToggle } from "./_status-toggle";
import { reorderContentAction } from "./_actions";

type SortModel = "intro" | "knowledge";
type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type SortableContentRow = {
  id: string;
  title: string;
  status: ContentStatus;
  category?: string | null;        // knowledge
  publishedAtText?: string | null; // intro
};

const chipStatus = (s: ContentStatus) =>
  s === "PUBLISHED" ? "PUBLISHED_OK" : s === "ARCHIVED" ? "OFFLINE_CONTENT" : "DRAFT";

export function SortableContentRows({
  model,
  items,
  listPath,
  editBase,
  sortable = true, // 列表被搜索/筛选时传 false:只展示当前子集,禁用拖拽(避免按子集重排污染全局顺序)
}: {
  model: SortModel;
  items: SortableContentRow[];
  listPath: string;
  editBase: string;
  sortable?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = rows.findIndex((r) => r.id === active.id);
    const newI = rows.findIndex((r) => r.id === over.id);
    if (oldI < 0 || newI < 0) return;
    const prev = rows;
    const next = arrayMove(rows, oldI, newI);
    setRows(next); // 乐观更新
    setSaving(true);
    setMsg(null);
    const res = await reorderContentAction(model, next.map((r) => r.id));
    setSaving(false);
    if (!res.ok) {
      setRows(prev); // 回滚
      setMsg(res.message);
    } else {
      router.refresh();
    }
  }

  const contentCols = model === "knowledge"
    ? ["问题 / 标题", "分类", "状态", "操作"]
    : ["标题", "状态", "发布时间", "操作"];
  const cols = sortable ? ["", ...contentCols] : contentCols;

  const table = (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted">
          {cols.map((h, i) => (
            <TableHead key={i} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortable ? (
          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            {rows.map((row) => (
              <SortableRow key={row.id} row={row} model={model} listPath={listPath} editBase={editBase} />
            ))}
          </SortableContext>
        ) : (
          rows.map((row) => (
            <TableRow key={row.id} className="bg-card hover:bg-muted">
              <RowCells row={row} model={model} listPath={listPath} editBase={editBase} />
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="rounded-lg border border-border bg-card">
      {(saving || msg) && (
        <p className={`px-4 py-2 text-[13px] ${msg ? "text-danger-strong" : "text-muted-foreground"}`}>
          {msg ?? "排序保存中…"}
        </p>
      )}
      {sortable
        ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>{table}</DndContext>
        : table}
    </div>
  );
}

function SortableRow(props: {
  row: SortableContentRow; model: SortModel; listPath: string; editBase: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.row.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <TableRow ref={setNodeRef} style={style} className="bg-card hover:bg-muted">
      <TableCell className="w-8 pr-0">
        <button
          type="button"
          aria-label="拖动排序"
          className="flex h-7 w-7 cursor-grab items-center justify-center rounded text-text-muted hover:bg-muted active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <RowCells {...props} />
    </TableRow>
  );
}

function RowCells({
  row, model, listPath, editBase,
}: {
  row: SortableContentRow; model: SortModel; listPath: string; editBase: string;
}) {
  return (
    <>
      <TableCell className="max-w-[380px] truncate font-medium text-foreground">{row.title}</TableCell>
      {model === "knowledge" && (
        <TableCell>
          {row.category
            ? <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{row.category}</span>
            : "—"}
        </TableCell>
      )}
      <TableCell><StatusChip status={chipStatus(row.status)} /></TableCell>
      {model === "intro" && (
        <TableCell className="text-[13px] text-muted-foreground">{row.publishedAtText ?? "—"}</TableCell>
      )}
      <TableCell>
        <div className="flex gap-2">
          <Link href={`${editBase}/${row.id}/edit`}>
            <Button size="sm" variant="outline" className="text-[12px]">编辑</Button>
          </Link>
          <StatusToggle model={model} id={row.id} status={row.status} revalidate={listPath} />
        </div>
      </TableCell>
    </>
  );
}
