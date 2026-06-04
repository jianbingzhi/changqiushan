// C 端响应序列化 — 统一裁剪敏感/内部字段(红线#5/#7:不下发 qrCode/qrSecret/*Key)
// 仅做字段投影,不含业务逻辑
import type { Booking, BookingSlot } from "@/modules/booking";
import type { ContentActivity, ContentIntro, ContentKnowledge, ContentNews } from "@/modules/content";
import type { TrafficParkingLot } from "@/modules/traffic";

function maskIdCard(idCard: string): string {
  if (idCard.length < 8) return "****";
  return idCard.slice(0, 4) + "*".repeat(idCard.length - 8) + idCard.slice(-4);
}

type BookingWithSlot = Booking & { slot?: BookingSlot | null };

// 预约单:不含 qrCode/qrSecret;身份证脱敏
export function publicBooking(b: BookingWithSlot) {
  return {
    id: b.id,
    status: b.status,
    visitorName: b.visitorName,
    idCardMasked: maskIdCard(b.idCard),
    phone: b.phone,
    plate: b.plate,
    noVehicleDeclared: b.noVehicleDeclared,
    channel: b.channel,
    createdAt: b.createdAt,
    checkedInAt: b.checkedInAt,
    cancelledAt: b.cancelledAt,
    slot: b.slot
      ? {
          id: b.slot.id,
          name: b.slot.name,
          date: b.slot.date,
          startTime: b.slot.startTime,
          endTime: b.slot.endTime,
        }
      : null,
  };
}

// 时段:只暴露小程序渠道可约名额,不泄漏其它渠道配额/在园计数明细
export function publicSlot(s: BookingSlot) {
  const remaining = Math.max(0, s.miniProgramQuota - s.miniProgramBooked);
  return {
    id: s.id,
    name: s.name,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    capacity: s.capacity,
    remaining,
    full: remaining <= 0,
    status: s.status,
    bookable: s.status === "ACTIVE" && remaining > 0,
  };
}

export function publicActivity(a: ContentActivity & { _count?: { signups: number } }) {
  const fee = Number(a.registrationFee.toString());
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    coverImage: a.coverImage,
    startDate: a.startDate,
    endDate: a.endDate,
    maxParticipants: a.maxParticipants,
    registrationFee: fee,
    isFree: fee === 0,
    signupCount: a._count?.signups ?? null,
    status: a.status,
  };
}

export function publicIntro(i: ContentIntro) {
  return {
    id: i.id,
    title: i.title,
    body: i.body,
    coverImage: i.coverImage,
    sortOrder: i.sortOrder,
    publishedAt: i.publishedAt,
  };
}

export function publicNews(n: ContentNews) {
  return {
    id: n.id,
    title: n.title,
    summary: n.summary,
    body: n.body,
    coverImage: n.coverImage,
    publishedAt: n.publishedAt,
  };
}

export function publicKnowledge(k: ContentKnowledge) {
  return {
    id: k.id,
    title: k.title,
    content: k.content,
    category: k.category,
    sortOrder: k.sortOrder,
  };
}

export function publicParkingLot(p: TrafficParkingLot) {
  const available = Math.max(0, p.capacity - p.occupied);
  return {
    id: p.id,
    name: p.name,
    capacity: p.capacity,
    occupied: p.occupied,
    available,
    status: p.status,
    location: p.location,
    coordinates: p.coordinates,
    updatedAt: p.updatedAt,
  };
}
