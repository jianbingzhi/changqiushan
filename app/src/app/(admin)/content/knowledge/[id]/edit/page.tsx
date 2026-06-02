import { notFound } from "next/navigation";
import { contentRepository } from "@/modules/content";
import { ContentForm } from "../../../_content-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "编辑知识条目 · 长秋山管理后台" };

export default async function EditKnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await contentRepository.getKnowledge(id);
  if (!item) notFound();
  return <ContentForm model="knowledge" id={id} initial={item} />;
}
