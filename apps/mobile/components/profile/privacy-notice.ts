import type { Lang } from "@/lib/messages";

/**
 * Data Privacy Notice (RA 10173) – docs/phase-2-architecture/05-privacy-and-consent.md §2 (English)
 * and §3 (Filipino), word for word. Keep both in sync with that document and the web /privacy page.
 */
export interface NoticeSection {
  heading: string;
  body?: string;
  bullets?: string[];
}

export interface PrivacyNotice {
  title: string;
  subtitle: string;
  sections: NoticeSection[];
}

export const PRIVACY_NOTICE: Record<Lang, PrivacyNotice> = {
  en: {
    title: "Data Privacy Notice",
    subtitle: "Barangay Kalawag II Health Workers Office – BHW QR Attendance System",
    sections: [
      {
        heading: "Who we are.",
        body: "The Barangay Kalawag II Health Workers (BHW) Office is the personal information controller for this system. Data Protection Officer: [name], [e-mail], [phone], Barangay Hall, Kalawag II, Isulan, Sultan Kudarat.",
      },
      {
        heading: "What we collect.",
        bullets: [
          "Account details: full name, BHW ID number, purok/area, e-mail address, mobile number, optional home address, profile photo.",
          "Attendance details: date and time of each time-in and time-out, the attendance station used, the scan result, and your phone's location and GPS accuracy at the moment you scan (not at any other time).",
          "Phone details: a one-way hashed code of your app installation, phone platform and model. We cannot recover your phone's real identifier from it.",
          "Optional: a selfie taken during scanning, only if the office turns this feature on.",
          "Correction requests you file, including any attachment.",
        ],
      },
      {
        heading: "What we do NOT collect.",
        body: "We do not collect fingerprints, face templates or any biometric data. If you use your phone's fingerprint or Face ID to unlock the scan screen, that check happens only on your phone and nothing is sent to us. We do not track your location outside of scanning.",
      },
      {
        heading: "Why we collect it.",
        body: "To record your attendance, compute lateness and undertime based on your approved schedule, prepare your Daily Time Record (CSC Form No. 48) and attendance reports, prevent fraudulent attendance, and keep an audit trail of changes.",
      },
      {
        heading: "Legal basis.",
        body: "Your consent, and the barangay's legal obligation and function to monitor the attendance of its personnel (RA 10173, Sections 12 and 13).",
      },
      {
        heading: "Who can see it.",
        body: "The BHW Office administrator(s); Barangay management can see reports and dashboards only (no locations or contact details). Your contact number and address are encrypted and visible only to you and the administrator. We do not sell or share your data with anyone else, except when required by law.",
      },
      {
        heading: "How long we keep it.",
        body: "Attendance records, correction requests and audit logs: 5 years. Scan attempt logs: 1 year. Selfies: 30 days. Error logs: 180 days. Rejected registrations: 90 days after rejection. See the full retention schedule with the DPO.",
      },
      {
        heading: "How we protect it.",
        body: "Encrypted connections (HTTPS) everywhere; encrypted storage of contact number and address; private file storage with short-lived links; role-based access; audit trail of every change; regular backups.",
      },
      {
        heading: "Your rights.",
        body: "You may ask to access, correct or (where the law allows) delete your personal data, object to processing, withdraw consent, and file a complaint with the National Privacy Commission (privacy.gov.ph). Withdrawing consent means you can no longer use the QR attendance system; your attendance will then be recorded manually by the administrator. Requests are answered within 15 days. Contact the DPO above.",
      },
      {
        heading: "Data breach.",
        body: "If a breach affecting your data happens, we will notify you and the National Privacy Commission within 72 hours of discovery.",
      },
    ],
  },
  fil: {
    title: "Abiso sa Privacy ng Datos",
    subtitle: "Barangay Kalawag II Health Workers Office – BHW QR Attendance System",
    sections: [
      {
        heading: "Sino kami.",
        body: "Ang Barangay Kalawag II Health Workers (BHW) Office ang personal information controller ng system na ito. Data Protection Officer: [pangalan], [e-mail], [telepono], Barangay Hall, Kalawag II, Isulan, Sultan Kudarat.",
      },
      {
        heading: "Ano ang kinokolekta namin.",
        bullets: [
          "Detalye ng account: buong pangalan, BHW ID number, purok/lugar, e-mail, mobile number, home address (opsyonal), larawan.",
          "Detalye ng attendance: petsa at oras ng bawat time-in at time-out, ang station na ginamit, resulta ng scan, at lokasyon ng iyong telepono at linaw ng GPS sa mismong oras lamang ng pag-scan.",
          "Detalye ng telepono: isang naka-hash na code ng iyong app installation, platform at model ng telepono. Hindi na namin makukuha mula rito ang tunay na identifier ng iyong telepono.",
          "Opsyonal: selfie habang nag-i-scan, kung bubuksan ng opisina ang feature na ito.",
          "Mga correction request na iyong isinusumite, kasama ang attachment.",
        ],
      },
      {
        heading: "Ang HINDI namin kinokolekta.",
        body: "Hindi kami kumukuha ng fingerprint, face template o anumang biometric data. Kung gagamitin mo ang fingerprint o Face ID ng iyong telepono para buksan ang scan screen, sa telepono mo lamang ito nangyayari at walang ipinapadala sa amin. Hindi namin sinusubaybayan ang iyong lokasyon maliban sa oras ng pag-scan.",
      },
      {
        heading: "Bakit namin ito kinokolekta.",
        body: "Upang maitala ang iyong attendance, makwenta ang pagka-late at undertime batay sa iyong aprubadong schedule, maihanda ang iyong Daily Time Record (CSC Form No. 48) at mga ulat, maiwasan ang pandaraya sa attendance, at magkaroon ng talaan ng lahat ng pagbabago.",
      },
      {
        heading: "Batayang legal.",
        body: "Ang iyong pahintulot, at ang tungkulin ng barangay na subaybayan ang attendance ng mga tauhan nito (RA 10173, Seksyon 12 at 13).",
      },
      {
        heading: "Sino ang makakakita.",
        body: "Ang administrator ng BHW Office; ang pamunuan ng Barangay ay makakakita lamang ng mga ulat at dashboard (walang lokasyon o contact details). Ang iyong mobile number at address ay naka-encrypt at ikaw at ang administrator lamang ang makakakita. Hindi namin ibinebenta o ibinabahagi ang iyong datos, maliban kung hinihingi ng batas.",
      },
      {
        heading: "Gaano katagal namin itatago.",
        body: "Attendance records, correction request at audit log: 5 taon. Talaan ng scan attempts: 1 taon. Selfie: 30 araw. Error logs: 180 araw. Na-reject na rehistro: 90 araw matapos ma-reject.",
      },
      {
        heading: "Paano namin ito pinoprotektahan.",
        body: "Naka-encrypt na koneksyon (HTTPS); naka-encrypt na pag-iimbak ng mobile number at address; pribadong file storage na may panandaliang link; access batay sa tungkulin; talaan ng bawat pagbabago; regular na backup.",
      },
      {
        heading: "Ang iyong mga karapatan.",
        body: "Maaari mong hilingin na makita, itama o (kung pinapayagan ng batas) burahin ang iyong personal na datos, tumutol sa pagproseso, bawiin ang pahintulot, at magreklamo sa National Privacy Commission (privacy.gov.ph). Kapag binawi mo ang pahintulot, hindi mo na magagamit ang QR attendance system; itatala na lamang nang mano-mano ng administrator ang iyong attendance. Sasagutin ang mga kahilingan sa loob ng 15 araw. Makipag-ugnayan sa DPO.",
      },
      {
        heading: "Data breach.",
        body: "Kung magkaroon ng breach na may kinalaman sa iyong datos, aabisuhan ka namin at ang National Privacy Commission sa loob ng 72 oras mula nang matuklasan ito.",
      },
    ],
  },
};
