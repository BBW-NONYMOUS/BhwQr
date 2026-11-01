import type { Lang } from "@bhw/types";

import type { Gate } from "@/lib/session";

export type BlockedReason = Extract<Gate, { kind: "blocked" }>["reason"];

/** Login / Blocked / Bind Device strings (EN / FIL) that STRINGS does not have. */
const en = {
  appName: "BHW Attendance",
  office: "Barangay Kalawag II Health Workers Office",
  email: "Email",
  emailPlaceholder: "you@example.com",
  password: "Password",
  passwordPlaceholder: "Your password",
  showPassword: "Show password",
  hidePassword: "Hide password",
  emailRequired: "Enter your email address.",
  emailInvalid: "Enter a valid email address, like name@example.com.",
  passwordRequired: "Enter your password.",
  badCredentials: "Email or password is incorrect. Please check and try again.",
  emailNotConfirmed: "Please confirm your email first. Open the link we sent to your inbox, then log in.",
  noAccount: "No account yet?",
  register: "Register on the website",
  language: "Language",
  checkAgain: "Check again",
  whatNext: "What to do next",
  reasonLabel: "Reason from the administrator",
  bindTitle: "Use this phone for attendance",
  bindBody:
    "This phone will be your attendance phone. Only this phone can record your time-in and time-out. If you change phones later, the administrator must reset your device first.",
  bindModel: "This phone",
  bindPrivacy: "Privacy: only a scrambled (hashed) ID of this app installation is stored. We do not collect your phone number, contacts, photos or fingerprints.",
  bindButton: "Use this phone",
  binding: "Registering this phone…",
  unknownModel: "Unknown model",
} as const;

const fil: Record<keyof typeof en, string> = {
  appName: "BHW Attendance",
  office: "Tanggapan ng mga Barangay Health Worker ng Kalawag II",
  email: "Email",
  emailPlaceholder: "ikaw@example.com",
  password: "Password",
  passwordPlaceholder: "Ang iyong password",
  showPassword: "Ipakita ang password",
  hidePassword: "Itago ang password",
  emailRequired: "Ilagay ang iyong email address.",
  emailInvalid: "Maglagay ng tamang email address, gaya ng pangalan@example.com.",
  passwordRequired: "Ilagay ang iyong password.",
  badCredentials: "Mali ang email o password. Pakisuri at subukang muli.",
  emailNotConfirmed: "Pakikumpirma muna ang iyong email. Buksan ang link na ipinadala namin, saka mag-log in.",
  noAccount: "Wala pang account?",
  register: "Magparehistro sa website",
  language: "Wika",
  checkAgain: "Suriin muli",
  whatNext: "Ano ang susunod na gagawin",
  reasonLabel: "Dahilan mula sa administrator",
  bindTitle: "Gamitin ang teleponong ito sa attendance",
  bindBody:
    "Ito ang magiging telepono mo sa attendance. Ang teleponong ito lamang ang makapagtatala ng iyong time-in at time-out. Kung magpapalit ka ng telepono, kailangan munang i-reset ng administrator ang iyong device.",
  bindModel: "Ang teleponong ito",
  bindPrivacy:
    "Privacy: isang naka-scramble (hashed) na ID lamang ng app na ito ang itinatago. Hindi namin kinukuha ang iyong numero, contacts, larawan o fingerprint.",
  bindButton: "Gamitin ang teleponong ito",
  binding: "Inirerehistro ang teleponong ito…",
  unknownModel: "Hindi alam na modelo",
};

export const AUTH_COPY: Record<Lang, Record<keyof typeof en, string>> = { en, fil };

export interface BlockedCopy {
  title: string;
  body: string;
  next: string;
}

/** Blocked screen explanation per reason (core flow 2, AC-01). */
export const BLOCKED_COPY: Record<BlockedReason, Record<Lang, BlockedCopy>> = {
  pending: {
    en: {
      title: "Waiting for approval",
      body: "Your registration was received and is waiting for the administrator's approval.",
      next: "You can log in again once you are approved. You will also get an email. Tap \"Check again\" after approval.",
    },
    fil: {
      title: "Hinihintay ang pag-apruba",
      body: "Natanggap ang iyong rehistro at hinihintay pa ang pag-apruba ng administrator.",
      next: "Makakapag-log in ka kapag naaprubahan na. Makakatanggap ka rin ng email. Pindutin ang \"Suriin muli\" pagkatapos maaprubahan.",
    },
  },
  rejected: {
    en: {
      title: "Registration not approved",
      body: "The administrator did not approve your registration.",
      next: "Please visit the BHW office to fix your details, or register again on the website.",
    },
    fil: {
      title: "Hindi naaprubahan ang rehistro",
      body: "Hindi inaprubahan ng administrator ang iyong rehistro.",
      next: "Pumunta po sa BHW office para itama ang iyong detalye, o magparehistro muli sa website.",
    },
  },
  inactive: {
    en: {
      title: "Account deactivated",
      body: "Your account is no longer active, so this app cannot record attendance for you.",
      next: "If you think this is a mistake, please talk to the BHW office administrator.",
    },
    fil: {
      title: "Naka-deactivate ang account",
      body: "Hindi na aktibo ang iyong account, kaya hindi makapagtatala ng attendance ang app na ito.",
      next: "Kung sa tingin mo ay mali ito, makipag-usap po sa administrator ng BHW office.",
    },
  },
  not_employee: {
    en: {
      title: "This app is for BHW employees",
      body: "Your account is not an employee account. Administrators and kiosks use the website instead.",
      next: "Log out and open the website on a computer or tablet.",
    },
    fil: {
      title: "Para sa mga BHW employee ang app na ito",
      body: "Hindi employee account ang iyong account. Ang mga administrator at kiosk ay gumagamit ng website.",
      next: "Mag-log out at buksan ang website sa computer o tablet.",
    },
  },
  device_mismatch: {
    en: {
      title: "Phone not registered to you",
      body: "Your account is registered to a different phone. For security, attendance can only be recorded on that phone.",
      next: "Ask the BHW office administrator to reset your device, then log in again on this phone.",
    },
    fil: {
      title: "Hindi nakarehistro sa iyo ang teleponong ito",
      body: "Nakarehistro ang iyong account sa ibang telepono. Para sa seguridad, sa teleponong iyon lamang maitatala ang attendance.",
      next: "Hilingin sa administrator ng BHW office na i-reset ang iyong device, saka mag-log in muli sa teleponong ito.",
    },
  },
};
