import { ok, err, ErrCode, type Result } from "@/shared/result";
import { canPublish, canArchive } from "../domain/rules";
import {
  createIntroSchema, updateIntroSchema,
  createNewsSchema, updateNewsSchema,
  createActivitySchema, updateActivitySchema,
  createKnowledgeSchema, updateKnowledgeSchema,
} from "../domain/schema";
import { contentRepository } from "../repository";

type ContentModel = "intro" | "activity" | "knowledge" | "news";

const CREATE_SCHEMAS = {
  intro: createIntroSchema,
  news: createNewsSchema,
  activity: createActivitySchema,
  knowledge: createKnowledgeSchema,
} as const;

const UPDATE_SCHEMAS = {
  intro: updateIntroSchema,
  news: updateNewsSchema,
  activity: updateActivitySchema,
  knowledge: updateKnowledgeSchema,
} as const;

async function getById(model: ContentModel, id: string) {
  switch (model) {
    case "intro":     return contentRepository.getIntro(id);
    case "activity":  return contentRepository.getActivity(id);
    case "knowledge": return contentRepository.getKnowledge(id);
    case "news":      return contentRepository.getNews(id);
  }
}

async function setStatus(model: ContentModel, id: string, data: object) {
  switch (model) {
    case "intro":     return contentRepository.updateIntro(id, data);
    case "activity":  return contentRepository.updateActivity(id, data);
    case "knowledge": return contentRepository.updateKnowledge(id, data);
    case "news":      return contentRepository.updateNews(id, data);
  }
}

// 知识库无 published_at 列,发布时不可写该字段(否则 Prisma 报 Unknown arg)
const HAS_PUBLISHED_AT: Record<ContentModel, boolean> = {
  intro: true, activity: true, news: true, knowledge: false,
};

export const contentService = {
  async publishContent(model: ContentModel, id: string): Promise<Result<void>> {
    const item = await getById(model, id);
    if (!item) return err(ErrCode.NOT_FOUND, "内容不存在");
    if (!canPublish(item.status)) return err(ErrCode.INVALID_INPUT, "仅草稿状态可发布");
    await setStatus(model, id, {
      status: "PUBLISHED",
      ...(HAS_PUBLISHED_AT[model] ? { publishedAt: new Date() } : {}),
    });
    return ok(undefined);
  },

  async archiveContent(model: ContentModel, id: string): Promise<Result<void>> {
    const item = await getById(model, id);
    if (!item) return err(ErrCode.NOT_FOUND, "内容不存在");
    if (!canArchive(item.status)) return err(ErrCode.INVALID_INPUT, "仅已发布状态可下线");
    await setStatus(model, id, { status: "ARCHIVED" });
    return ok(undefined);
  },

  // B04: 新建内容(草稿)。各模型 zod 校验,正文为 TipTap 输出的 HTML 字符串。
  async createContent(model: ContentModel, raw: unknown): Promise<Result<{ id: string }>> {
    const parsed = CREATE_SCHEMAS[model].safeParse(raw);
    if (!parsed.success) return err(ErrCode.INVALID_INPUT, parsed.error.issues[0].message);
    const d = parsed.data;
    let row: { id: string };
    switch (model) {
      case "intro":     row = await contentRepository.createIntro(d as never); break;
      case "news":      row = await contentRepository.createNews(d as never); break;
      case "activity":  row = await contentRepository.createActivity(d as never); break;
      case "knowledge": row = await contentRepository.createKnowledge(d as never); break;
    }
    return ok({ id: row.id });
  },

  // B04: 编辑内容(部分更新)。
  async updateContent(model: ContentModel, id: string, raw: unknown): Promise<Result<void>> {
    const existing = await getById(model, id);
    if (!existing) return err(ErrCode.NOT_FOUND, "内容不存在");
    const parsed = UPDATE_SCHEMAS[model].safeParse(raw);
    if (!parsed.success) return err(ErrCode.INVALID_INPUT, parsed.error.issues[0].message);
    await setStatus(model, id, parsed.data);
    return ok(undefined);
  },
};
