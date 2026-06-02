import { ContentForm } from "../../_content-form";

export const metadata = { title: "新建资讯 · 长秋山管理后台" };

export default function NewNewsPage() {
  return <ContentForm model="news" />;
}
