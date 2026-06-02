import { db } from "@/infrastructure/db/client";
import type { Prisma } from "@prisma/client";

export const contentRepository = {
  // ── 景区介绍 ─────────────────────────────────────────────────────────────
  listIntros()  { return db.contentIntro.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }); },
  getIntro(id: string) { return db.contentIntro.findUnique({ where: { id } }); },
  createIntro(data: Prisma.ContentIntroCreateInput) { return db.contentIntro.create({ data }); },
  updateIntro(id: string, data: Prisma.ContentIntroUpdateInput) { return db.contentIntro.update({ where: { id }, data }); },
  deleteIntro(id: string) { return db.contentIntro.delete({ where: { id } }); },

  // ── 活动 ─────────────────────────────────────────────────────────────────
  listActivities()  { return db.contentActivity.findMany({ orderBy: { startDate: "desc" } }); },
  getActivity(id: string) { return db.contentActivity.findUnique({ where: { id } }); },
  createActivity(data: Prisma.ContentActivityCreateInput) { return db.contentActivity.create({ data }); },
  updateActivity(id: string, data: Prisma.ContentActivityUpdateInput) { return db.contentActivity.update({ where: { id }, data }); },
  countActivities() { return db.contentActivity.count(); },

  // ── 报名 ─────────────────────────────────────────────────────────────────
  listSignups(activityId: string) { return db.contentActivitySignup.findMany({ where: { activityId }, orderBy: { createdAt: "desc" } }); },
  getSignup(id: string) { return db.contentActivitySignup.findUnique({ where: { id } }); },
  updateSignup(id: string, data: Prisma.ContentActivitySignupUpdateInput) { return db.contentActivitySignup.update({ where: { id }, data }); },

  // ── 知识库 ────────────────────────────────────────────────────────────────
  listKnowledge(category?: string) {
    return db.contentKnowledge.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  },
  getKnowledge(id: string) { return db.contentKnowledge.findUnique({ where: { id } }); },
  createKnowledge(data: Prisma.ContentKnowledgeCreateInput) { return db.contentKnowledge.create({ data }); },
  updateKnowledge(id: string, data: Prisma.ContentKnowledgeUpdateInput) { return db.contentKnowledge.update({ where: { id }, data }); },

  // ── 资讯 ─────────────────────────────────────────────────────────────────
  listNews()  { return db.contentNews.findMany({ orderBy: { publishedAt: "desc" } }); },
  getNews(id: string) { return db.contentNews.findUnique({ where: { id } }); },
  createNews(data: Prisma.ContentNewsCreateInput) { return db.contentNews.create({ data }); },
  updateNews(id: string, data: Prisma.ContentNewsUpdateInput) { return db.contentNews.update({ where: { id }, data }); },
};
