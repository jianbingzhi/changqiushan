"use server";

import { revalidatePath } from "next/cache";
import { contentService } from "@/modules/content";
import { requireRole, ADMIN_UP } from "@/infrastructure/auth/guard";

export type ContentModel = "intro" | "activity" | "knowledge" | "news";
export type ContentActionResult = { ok: boolean; message: string };

/** 内容发布(草稿→已发布);各列表页复用 */
export async function publishContentAction(
  model: ContentModel,
  id: string,
  revalidate: string,
): Promise<ContentActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return auth;
  const r = await contentService.publishContent(model, id);
  if (!r.ok) return { ok: false, message: r.message };
  revalidatePath(revalidate);
  return { ok: true, message: "已发布" };
}

/** 内容下线(已发布→已归档) */
export async function archiveContentAction(
  model: ContentModel,
  id: string,
  revalidate: string,
): Promise<ContentActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return auth;
  const r = await contentService.archiveContent(model, id);
  if (!r.ok) return { ok: false, message: r.message };
  revalidatePath(revalidate);
  return { ok: true, message: "已下线" };
}
