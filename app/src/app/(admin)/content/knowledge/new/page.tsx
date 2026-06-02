import { ContentForm } from "../../_content-form";

export const metadata = { title: "新建知识条目 · 长秋山管理后台" };

export default function NewKnowledgePage() {
  return <ContentForm model="knowledge" />;
}
