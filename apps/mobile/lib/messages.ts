import { errorMessage as catalogMessage, type Lang } from "@bhw/types";
import { statusColors, type AttendanceStatusToken } from "@bhw/design-tokens";

export type { Lang };

/** Error-code → friendly message (English / Filipino) from the shared catalog (FR-56). */
export function errorMessage(code: string, lang: Lang, params: Record<string, string | number> = {}): string {
  return catalogMessage(code, lang, params);
}

export function statusLabel(status: AttendanceStatusToken, lang: Lang): string {
  return lang === "fil" ? statusColors[status].labelFil : statusColors[status].label;
}

/** UI strings used across screens. Keys are stable; both languages are always complete. */
export const STRINGS = {
  en: {
    scan: "Scan",
    home: "Home",
    history: "History",
    myQr: "My QR",
    profile: "Profile",
    today: "Today",
    thisWeek: "This week",
    recent: "Recent",
    timeIn: "Time-in",
    timeOut: "Time-out",
    noRecordToday: "No scan yet today",
    offline: "You are offline. Scans are not saved while offline.",
    retry: "Try again",
    openSettings: "Open settings",
    requestCorrection: "Request correction",
    contactAdmin: "Please contact the BHW office administrator.",
    logout: "Log out",
    login: "Log in",
    healthTitle: "Before you scan",
    healthCamera: "Camera permission",
    healthLocation: "Location permission",
    healthGps: "GPS accuracy",
    healthInternet: "Internet connection",
    healthDevice: "Phone registered to you",
    startScan: "Start scanning",
    pointCamera: "Point the camera at the QR code on the kiosk screen",
  },
  fil: {
    scan: "I-scan",
    home: "Home",
    history: "Kasaysayan",
    myQr: "Aking QR",
    profile: "Profile",
    today: "Ngayong araw",
    thisWeek: "Ngayong linggo",
    recent: "Mga huling tala",
    timeIn: "Time-in",
    timeOut: "Time-out",
    noRecordToday: "Wala pang scan ngayong araw",
    offline: "Offline ka. Hindi naitatala ang scan habang offline.",
    retry: "Subukang muli",
    openSettings: "Buksan ang settings",
    requestCorrection: "Humiling ng pagtatama",
    contactAdmin: "Makipag-ugnayan po sa administrator ng BHW office.",
    logout: "Mag-log out",
    login: "Mag-log in",
    healthTitle: "Bago mag-scan",
    healthCamera: "Pahintulot sa camera",
    healthLocation: "Pahintulot sa lokasyon",
    healthGps: "Linaw ng GPS",
    healthInternet: "Internet connection",
    healthDevice: "Nakarehistro sa iyo ang telepono",
    startScan: "Simulan ang pag-scan",
    pointCamera: "Itutok ang camera sa QR code sa screen ng kiosk",
  },
} as const satisfies Record<Lang, Record<string, string>>;

export type StringKey = keyof (typeof STRINGS)["en"];
