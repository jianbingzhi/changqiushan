"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contentService } from "@/modules/content";
import { requireRole, ADMIN_UP } from "@/infrastructure/auth/guard";

export type ContentModel = "intro" | "activity" | "knowledge" | "news";
export type ContentActionResult = { ok: boolean; message: string };

const LIST_PATH: Record<ContentModel, string> = {
  intro: "/content/intro",
  news: "/content/news",
  activity: "/content/activities",
  knowledge: "/content/knowledge",
};

/**
 * B04: 新建/编辑内容(富文本)。成功后 revalidate 列表并重定向回列表;失败返回错误。
 * id 为空=新建,否则=编辑。
 */
export async function saveContentAction(
  model: ContentModel,
  id: string | null,
  payload: Record<string, unknown>,
): Promise<ContentActionResult | void> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return auth;
  const res = id
    ? await contentService.updateContent(model, id, payload)
    : await contentService.createContent(model, payload);
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath(LIST_PATH[model]);
  redirect(LIST_PATH[model]);
}

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
