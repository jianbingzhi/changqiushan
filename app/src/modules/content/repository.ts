import { db } from "@/infrastructure/db/client";
import type { Prisma } from "@prisma/client";

export const contentRepository = {
  // ── 排序(整表重排,按数组下标写 sortOrder;事务保证一致) ──────────────────
  reorderIntros(ids: string[]) {
    return db.$transaction(ids.map((id, i) => db.contentIntro.update({ where: { id }, data: { sortOrder: i } })));
  },
  reorderKnowledge(ids: string[]) {
    return db.$transaction(ids.map((id, i) => db.contentKnowledge.update({ where: { id }, data: { sortOrder: i } })));
  },

  // ── 景区介绍 ─────────────────────────────────────────────────────────────
  listIntros()  { return db.contentIntro.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }); },
  getIntro(id: string) { return db.contentIntro.findUnique({ where: { id } }); },
  createIntro(data: Prisma.ContentIntroCreateInput) { return db.contentIntro.create({ data }); },
  updateIntro(id: string, data: Prisma.ContentIntroUpdateInput) { return db.contentIntro.update({ where: { id }, data }); },
  deleteIntro(id: string) { return db.contentIntro.delete({ where: { id } }); },

  // ── 活动 ─────────────────────────────────────────────────────────────────
  listActivities()  { return db.contentActivity.findMany({ orderBy: { startDate: "desc" } }); },
  // B05: 活动列表 + 报名人数(_count)
  listActivitiesWithCounts() {
    return db.contentActivity.findMany({
      orderBy: { startDate: "desc" },
      include: { _count: { select: { signups: true } } },
    });
  },
  getActivity(id: string) { return db.contentActivity.findUnique({ where: { id } }); },
  createActivity(data: Prisma.ContentActivityCreateInput) { return db.contentActivity.create({ data }); },
  updateActivity(id: string, data: Prisma.ContentActivityUpdateInput) { return db.contentActivity.update({ where: { id }, data }); },
  countActivities() { return db.contentActivity.count(); },

  // ── 报名 ─────────────────────────────────────────────────────────────────
  listSignups(activityId: string) { return db.contentActivitySignup.findMany({ where: { activityId }, orderBy: { createdAt: "desc" } }); },
  getSignup(id: string) { return db.contentActivitySignup.findUnique({ where: { id } }); },
  updateSignup(id: string, data: Prisma.ContentActivitySignupUpdateInput) { return db.contentActivitySignup.update({ where: { id }, data }); },
  // C 端报名:建单 / 名额计数 / 防重(同活动同身份证)
  createSignup(data: { activityId: string; userId: string; userName: string; phone: string }) {
    return db.contentActivitySignup.create({ data });
  },
  countSignups(activityId: string) { return db.contentActivitySignup.count({ where: { activityId } }); },
  findSignupByUser(activityId: string, userId: string) {
    return db.contentActivitySignup.findFirst({ where: { activityId, userId } });
  },

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

  // ── 获奖公示 ──────────────────────────────────────────────────────────────
  listAwards(activityId: string) {
    return db.contentAward.findMany({ where: { activityId }, orderBy: { announcedAt: "desc" } });
  },
  createAward(data: Prisma.ContentAwardCreateInput) { return db.contentAward.create({ data }); },
  deleteAward(id: string) { return db.contentAward.delete({ where: { id } }); },

  // ── 导览 POI ─────────────────────────────────────────────────────────────
  listPois(category?: string) {
    return db.contentPoi.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  },
  getPoi(id: string) { return db.contentPoi.findUnique({ where: { id } }); },

  // ── 资讯 ─────────────────────────────────────────────────────────────────
  listNews()  { return db.contentNews.findMany({ orderBy: { publishedAt: "desc" } }); },
  getNews(id: string) { return db.contentNews.findUnique({ where: { id } }); },
  createNews(data: Prisma.ContentNewsCreateInput) { return db.contentNews.create({ data }); },
  updateNews(id: string, data: Prisma.ContentNewsUpdateInput) { return db.contentNews.update({ where: { id }, data }); },

  // ── 媒体素材库(R-素材) ──────────────────────────────────────────────────
  listAssets(activityId?: string) {
    return db.contentAsset.findMany({
      where: activityId ? { activityId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  },
  getAsset(id: string) { return db.contentAsset.findUnique({ where: { id } }); },
  createAsset(data: Prisma.ContentAssetCreateInput) { return db.contentAsset.create({ data }); },
  deleteAsset(id: string) { return db.contentAsset.delete({ where: { id } }); },
};
