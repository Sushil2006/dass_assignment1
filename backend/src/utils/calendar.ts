export type CalendarEventInput = {
  uid: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  url?: string;
};

type BuildCalendarIcsInput = {
  calendarName: string;
  events: CalendarEventInput[];
  reminderMinutes?: number | null;
};

function formatUtcDateTime(value: Date): string {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildEventBlock(
  event: CalendarEventInput,
  nowUtc: string,
  reminderMinutes?: number | null,
): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(event.uid)}`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${formatUtcDateTime(event.startDate)}`,
    `DTEND:${formatUtcDateTime(event.endDate)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];

  if (event.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description.trim())}`);
  }

  if (event.url?.trim()) {
    lines.push(`URL:${escapeIcsText(event.url.trim())}`);
  }

  if (typeof reminderMinutes === "number" && reminderMinutes > 0) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Event reminder",
      `TRIGGER:-PT${Math.floor(reminderMinutes)}M`,
      "END:VALARM",
    );
  }

  lines.push("END:VEVENT");
  return lines;
}

export function buildCalendarIcs(input: BuildCalendarIcsInput): string {
  const nowUtc = formatUtcDateTime(new Date());
  const reminderMinutes =
    typeof input.reminderMinutes === "number" && input.reminderMinutes > 0
      ? input.reminderMinutes
      : null;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Felicity Event Management//Assignment1//EN",
    `X-WR-CALNAME:${escapeIcsText(input.calendarName)}`,
  ];

  for (const event of input.events) {
    lines.push(...buildEventBlock(event, nowUtc, reminderMinutes));
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
