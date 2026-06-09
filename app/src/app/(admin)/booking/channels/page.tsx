import { PageHeader } from "@/lib/ui/page-header";
import { channelService } from "@/modules/booking";
import { Channels, type ChannelRow } from "./_channels";

export const dynamic = "force-dynamic";
export const metadata = { title: "渠道预约接入 · 长秋山管理后台" };

export default async function ChannelsPage() {
  const list = await channelService.list().catch(() => []);
  const channels: ChannelRow[] = list.map((c) => ({
    code: c.code,
    label: c.label,
    description: c.description,
    enabled: c.enabled,
    sortOrder: c.sortOrder,
  }));

  return (
    <>
      <PageHeader
        title="渠道预约接入"
        description="管理各预约渠道的名称/说明/排序与启停;停用后该渠道不再接收新预约。各渠道名额在「分时预约配额配置」按时段设置"
      />
      <Channels channels={channels} />
    </>
  );
}
