import { analyticsRepository, type DailyTrafficRow, type VisitorSourceRow, type HourlyPeakRow } from "../repository";
import { ok, type Result } from "@/shared/result";

export type TrafficReportRow = {
  date:           string;
  totalVisitors:  number;
  checkedInCount: number;
  cancelledCount: number;
  noshowCount:    number;
};

export type SourceReportRow = {
  sourceChannel: string;
  visitorCount:  number;
  percentage:    number;
};

export type HourlyPeakReportRow = {
  hour:        number;
  avgVisitors: number;
  maxVisitors: number;
};

function toTraffic(r: DailyTrafficRow): TrafficReportRow {
  return {
    date:           r.date,
    totalVisitors:  Number(r.total_visitors),
    checkedInCount: Number(r.checked_in_count),
    cancelledCount: Number(r.cancelled_count),
    noshowCount:    Number(r.noshow_count),
  };
}

function toSource(r: VisitorSourceRow): SourceReportRow {
  return { sourceChannel: r.source_channel, visitorCount: Number(r.visitor_count), percentage: r.percentage };
}

function toHourly(r: HourlyPeakRow): HourlyPeakReportRow {
  return { hour: r.hour, avgVisitors: r.avg_visitors, maxVisitors: Number(r.max_visitors) };
}

export const analyticsService = {
  async getTrafficReport(startDate: Date, endDate: Date): Promise<Result<TrafficReportRow[]>> {
    const rows = await analyticsRepository.getDailyTraffic(startDate, endDate);
    return ok(rows.map(toTraffic));
  },

  async getSourceReport(startDate?: Date, endDate?: Date): Promise<Result<SourceReportRow[]>> {
    const rows = await analyticsRepository.getVisitorSource(startDate, endDate);
    return ok(rows.map(toSource));
  },

  async getHourlyPeakReport(): Promise<Result<HourlyPeakReportRow[]>> {
    const rows = await analyticsRepository.getHourlyPeak();
    return ok(rows.map(toHourly));
  },
};
