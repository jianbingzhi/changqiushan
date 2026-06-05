// C 端响应公开数据形状(与 app BFF _lib/serialize.ts 对应)

export interface PublicSlot {
  id: string
  name: string
  date: string
  startTime: string
  endTime: string
  capacity: number
  remaining: number
  full: boolean
  status: 'ACTIVE' | 'PAUSED' | 'CLOSED'
  bookable: boolean
}

export interface PublicBookingSlot {
  id: string
  name: string
  date: string
  startTime: string
  endTime: string
}

export interface PublicBooking {
  id: string
  status: 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED' | 'NO_SHOW' | 'EXPIRED'
  visitorName: string
  idCardMasked: string
  phone: string
  plate: string | null
  noVehicleDeclared: boolean
  channel: string
  createdAt: string
  checkedInAt: string | null
  cancelledAt: string | null
  slot: PublicBookingSlot | null
}

export interface VisitorStats {
  pending: number
  checkedIn: number
  noShow: number
  cancelled: number
  total: number
}

export interface PublicActivity {
  id: string
  title: string
  description: string | null
  coverImage: string | null
  startDate: string
  endDate: string
  maxParticipants: number | null
  registrationFee: number
  isFree: boolean
  signupCount: number | null
  status: string
}

export interface PublicIntro {
  id: string
  title: string
  body: string
  coverImage: string | null
  sortOrder: number
  publishedAt: string | null
}

export interface PublicNews {
  id: string
  title: string
  summary: string | null
  body: string
  coverImage: string | null
  publishedAt: string | null
}

export interface PublicKnowledge {
  id: string
  title: string
  content: string
  category: string | null
  sortOrder: number
}

export interface PublicPoi {
  id: string
  name: string
  category: string
  latitude: number
  longitude: number
  description: string | null
  coverImage: string | null
  sortOrder: number
}

export interface PublicParkingLot {
  id: string
  name: string
  capacity: number
  occupied: number
  available: number
  status: 'OPEN' | 'FULL' | 'CLOSED'
  location: string | null
  coordinates: unknown
  updatedAt: string
}
