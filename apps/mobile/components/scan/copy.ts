import type { Lang } from "@bhw/types";

/** Scan / health-check / result strings (EN / FIL) that STRINGS does not have. */
const en = {
  healthIntro: "We check these so your scan is accepted the first time.",
  fix: "Fix",
  checking: "Checking…",
  gpsLive: "{accuracy} m (needs {max} m or better)",
  gpsWaiting: "Waiting for GPS…",
  gpsTip: "Move near a window or step outside for a better GPS signal.",
  deviceOk: "This phone is registered to you",
  cancel: "Cancel",
  close: "Close",
  done: "Done",
  torchOn: "Turn on flashlight",
  torchOff: "Turn off flashlight",
  notKioskQr: "That is not the attendance QR. Scan the QR on the kiosk screen.",
  sending: "Recording your attendance…",
  loginAgain: "Log in again",
  autoClose: "Going back to Home…",
  cameraNeeded: "Camera permission is needed to scan.",
} as const;

const fil: Record<keyof typeof en, string> = {
  healthIntro: "Sinusuri namin ang mga ito para matanggap agad ang iyong scan.",
  fix: "Ayusin",
  checking: "Sinusuri…",
  gpsLive: "{accuracy} m (kailangan {max} m o mas mababa)",
  gpsWaiting: "Hinihintay ang GPS…",
  gpsTip: "Lumapit sa bintana o lumabas para gumanda ang GPS signal.",
  deviceOk: "Nakarehistro sa iyo ang teleponong ito",
  cancel: "Kanselahin",
  close: "Isara",
  done: "Tapos na",
  torchOn: "Buksan ang flashlight",
  torchOff: "Patayin ang flashlight",
  notKioskQr: "Hindi iyan ang attendance QR. I-scan ang QR sa screen ng kiosk.",
  sending: "Itinatala ang iyong attendance…",
  loginAgain: "Mag-log in muli",
  autoClose: "Babalik sa Home…",
  cameraNeeded: "Kailangan ang pahintulot sa camera para makapag-scan.",
};

export const SCAN_COPY: Record<Lang, Record<keyof typeof en, string>> = { en, fil };
