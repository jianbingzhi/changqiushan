import { bookingRepository } from "@/modules/booking";
import { formatCnDate } from "@/shared/format";

export const dynamic = "force-dynamic";

export default async function BookingSlotsPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const slots = await bookingRepository.listSlotsByDate(today);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold mb-6">分时预约配额配置</h1>
      <p className="text-sm text-gray-500 mb-4">
        日期：{formatCnDate(today)} · 共 {slots.length} 个时段
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 px-3 font-medium text-sm">时段</th>
            <th className="py-2 px-3 font-medium text-sm">开始</th>
            <th className="py-2 px-3 font-medium text-sm">结束</th>
            <th className="py-2 px-3 font-medium text-sm">总名额</th>
            <th className="py-2 px-3 font-medium text-sm">已预约</th>
            <th className="py-2 px-3 font-medium text-sm">状态</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => (
            <tr key={s.id} className="border-b hover:bg-gray-50">
              <td className="py-2 px-3">{s.name}</td>
              <td className="py-2 px-3">{s.startTime}</td>
              <td className="py-2 px-3">{s.endTime}</td>
              <td className="py-2 px-3">{s.capacity}</td>
              <td className="py-2 px-3">{s.bookedCount}</td>
              <td className="py-2 px-3">{s.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
