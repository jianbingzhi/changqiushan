import { redirect } from "next/navigation";

// 旧实时大屏已迁移并重着色为 C1 综合态势主屏(无登录挂墙版)。此路由永久重定向。
export default function RealtimeRedirectPage() {
  redirect("/screen/situation");
}
