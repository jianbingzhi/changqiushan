import { notFound } from "next/navigation";
import { contentRepository } from "@/modules/content";
import { ContentForm } from "../../../_content-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "编辑活动 · 长秋山管理后台" };

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await contentRepository.getActivity(id);
  if (!item) notFound();
  // registrationFee 是 Prisma.Decimal,不可直接跨 RSC→client 边界序列化,转 number
  const initial = { ...item, registrationFee: Number(item.registrationFee) };
  return <ContentForm model="activity" id={id} initial={initial} />;
}
