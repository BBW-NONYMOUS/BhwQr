import type { Lang } from "@bhw/types";

/** Fills {placeholders} in a copy string. */
export function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

/**
 * Home-only UI strings (EN / FIL). Shared words (Today, This week, Time-in, Scan, offline…) come
 * from STRINGS through usePreferences().t(); these are the strings STRINGS does not have yet.
 */
const en = {
  goodMorning: "Good morning",
  goodAfternoon: "Good afternoon",
  goodEvening: "Good evening",
  schedule: "Schedule",
  noSchedule: "No schedule assigned yet. Please ask the BHW office.",
  restDay: "Rest day — no work scheduled today.",
  graceMinutes: "{minutes}-min grace period",
  weekSummary: "{present} of {scheduled} work days with time-in",
  weekNoSchedule: "No scheduled work days this week.",
  seeAll: "See all",
  myDtr: "My DTR",
  noRecords: "No attendance records yet. Your scans will appear here.",
  unread: "You have {count} unread notifications.",
  unreadOne: "You have 1 unread notification.",
  loadFailed: "We could not load your attendance.",
  scanLabel: "Scan the kiosk QR code to record attendance",
  scanDisabledOffline: "Scanning is off while you are offline",
  biometricPrompt: "Confirm it's you to scan",
  late: "{minutes} min late",
  undertime: "{minutes} min undertime",
} as const;

const fil: Record<keyof typeof en, string> = {
  goodMorning: "Magandang umaga",
  goodAfternoon: "Magandang hapon",
  goodEvening: "Magandang gabi",
  schedule: "Iskedyul",
  noSchedule: "Wala ka pang iskedyul. Magtanong po sa BHW office.",
  restDay: "Pahinga — walang pasok ngayong araw.",
  graceMinutes: "{minutes} minutong palugit",
  weekSummary: "{present} sa {scheduled} araw ng pasok na may time-in",
  weekNoSchedule: "Walang nakatakdang pasok ngayong linggo.",
  seeAll: "Tingnan lahat",
  myDtr: "Aking DTR",
  noRecords: "Wala pang tala ng attendance. Lalabas dito ang iyong mga scan.",
  unread: "May {count} kang hindi pa nababasang abiso.",
  unreadOne: "May 1 kang hindi pa nababasang abiso.",
  loadFailed: "Hindi ma-load ang iyong attendance.",
  scanLabel: "I-scan ang QR code ng kiosk para maitala ang attendance",
  scanDisabledOffline: "Hindi makapag-scan habang offline",
  biometricPrompt: "Kumpirmahin na ikaw ito bago mag-scan",
  late: "{minutes} minutong huli",
  undertime: "{minutes} minutong kulang",
};

export const HOME_COPY: Record<Lang, Record<keyof typeof en, string>> = { en, fil };
