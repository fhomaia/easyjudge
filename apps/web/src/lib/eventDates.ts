import { addDays, endOfDay, isWithinInterval, parseISO, startOfDay } from "date-fns";
import type { Event } from "@/api/client";

export function isEventDay(event: Event): boolean {
  const start = startOfDay(parseISO(event.startDate));
  const end = endOfDay(addDays(start, event.competitionDays - 1));
  return isWithinInterval(new Date(), { start, end });
}
