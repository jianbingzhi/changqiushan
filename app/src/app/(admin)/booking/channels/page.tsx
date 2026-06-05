import { PageHeader } from "@/lib/ui/page-header";
import { channelLabel } from "@/shared/labels";

export const metadata = { title: "渠道预约接入 · 长秋山管理后台" };

// 渠道名取自共用 labels(D7),此处仅补充说明文案。渠道枚举码是技术标识,不在 UI 展示(P7)。
const CHANNELS = [
  { code: "MINI_PROGRAM",  desc: "微信小程序在线预约",      status: "已启用" },
  { code: "ONSITE_MAKEUP", desc: "管理员现场录入补录",      status: "已启用" },
  { code: "OTA",           desc: "第三方平台（美团/携程）", status: "已启用" },
  { code: "ADMIN_MANUAL",  desc: "后台管理员直接创建",      status: "已启用" },
];

export default function ChannelsPage() {
  return (
    <>
      <PageHeader
        title="渠道预约接入"
        description="各渠道配额在「分时预约配额配置」页面按时段设置"
      />
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
              <th className="py-3 px-4 text-left font-medium text-[#6B7280]">渠道名称</th>
              <th className="py-3 px-4 text-left font-medium text-[#6B7280]">说明</th>
              <th className="py-3 px-4 text-left font-medium text-[#6B7280]">状态</th>
            </tr>
          </thead>
          <tbody>
            {CHANNELS.map((ch) => (
              <tr key={ch.code} className="border-b border-[#E5E7EB] last:border-0">
                <td className="py-3 px-4 font-medium text-[#1F2937]">{channelLabel(ch.code)}</td>
                <td className="py-3 px-4 text-[#6B7280]">{ch.desc}</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                    {ch.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
