import { errorMessage, isErrorCode } from "@bhw/types";

/**
 * Bilingual messages for the sign-in, password and registration screens. Codes from the shared
 * catalog (EMAIL_TAKEN, RATE_LIMITED, ...) come from `errorMessage`; the few auth-only codes
 * below are not part of the scan/RPC catalog because Supabase Auth, not our SQL, raises them.
 */
const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: {
    en: "Incorrect email or password. Please try again.",
    fil: "Mali po ang email o password. Pakisubukang muli.",
  },
  EMAIL_NOT_CONFIRMED: {
    en: "Please verify your email first. Open the link we sent to your inbox, then log in.",
    fil: "Paki-verify po muna ang iyong email. Buksan ang link na ipinadala namin sa iyong inbox, saka mag-login.",
  },
  ACCOUNT_INACTIVE: {
    en: "Your account has been deactivated. Please contact the BHW office administrator.",
    fil: "Na-deactivate ang iyong account. Makipag-ugnayan po sa administrator ng BHW office.",
  },
  PROFILE_NOT_FOUND: {
    en: "We could not find a profile for this account. Please contact the BHW office administrator.",
    fil: "Hindi po namin makita ang profile ng account na ito. Makipag-ugnayan po sa administrator ng BHW office.",
  },
  WEAK_PASSWORD: {
    en: "This password is too easy to guess. Please choose a longer or less common password.",
    fil: "Madaling hulaan ang password na ito. Pumili po ng mas mahaba o hindi karaniwang password.",
  },
  SAME_PASSWORD: {
    en: "The new password must be different from your old password.",
    fil: "Dapat iba po ang bagong password sa dati mong password.",
  },
  CHECK_FIELDS: {
    en: "Please check the highlighted fields.",
    fil: "Pakisuri po ang mga field na may marka.",
  },
  PHOTO_UNAVAILABLE: {
    en: "Your registration was saved, but the photo could not be uploaded. You can add it later.",
    fil: "Naisumite ang iyong rehistro, pero hindi na-upload ang larawan. Maaari mo itong idagdag mamaya.",
  },
} as const;

export type AuthMessageCode = keyof typeof AUTH_MESSAGES;

export interface BilingualText {
  en: string;
  fil: string;
}

export function authMessage(code: string): BilingualText {
  if (code in AUTH_MESSAGES) return AUTH_MESSAGES[code as AuthMessageCode];
  const known = isErrorCode(code) ? code : "INTERNAL_ERROR";
  return { en: errorMessage(known, "en"), fil: errorMessage(known, "fil") };
}
