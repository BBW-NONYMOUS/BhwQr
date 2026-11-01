import type { ReactNode } from "react";

/**
 * Data Privacy Notice (RA 10173), English and Filipino, exactly as approved in
 * docs/phase-2-architecture/05-privacy-and-consent.md §2–§3. The barangay fills in the Data
 * Protection Officer details below before go-live (same values for both languages).
 */
export const DPO_CONTACT = {
  name: { en: "[name]", fil: "[pangalan]" },
  email: "[e-mail]",
  phone: { en: "[phone]", fil: "[telepono]" },
} as const;

export const PRIVACY_TITLE = "Barangay Kalawag II Health Workers Office – BHW QR Attendance System";

/** The consent statement shown next to the registration checkbox (§1). */
export const CONSENT_TEXT = {
  en: {
    before: "I have read and understood the ",
    link: "Data Privacy Notice",
    after:
      ". I agree that Barangay Kalawag II may collect and process my personal information for attendance monitoring, Daily Time Records and reports, as described in the notice.",
  },
  fil: {
    before: "Nabasa ko at naunawaan ang ",
    link: "Abiso sa Privacy ng Datos",
    after:
      ". Pumapayag ako na kolektahin at iproseso ng Barangay Kalawag II ang aking personal na impormasyon para sa pagsubaybay ng attendance, Daily Time Record at mga ulat, ayon sa nakasaad sa abiso.",
  },
} as const;

interface Section {
  id: string;
  heading: string;
  body: ReactNode;
}

const NPC = (
  <a
    href="https://privacy.gov.ph"
    className="hover:text-foreground underline underline-offset-4"
    rel="noopener noreferrer"
    target="_blank"
  >
    privacy.gov.ph
  </a>
);

export const PRIVACY_EN: readonly Section[] = [
  {
    id: "who-we-are",
    heading: "Who we are",
    body: (
      <p>
        The Barangay Kalawag II Health Workers (BHW) Office is the personal information controller
        for this system. Data Protection Officer: {DPO_CONTACT.name.en}, {DPO_CONTACT.email},{" "}
        {DPO_CONTACT.phone.en}, Barangay Hall, Kalawag II, Isulan, Sultan Kudarat.
      </p>
    ),
  },
  {
    id: "what-we-collect",
    heading: "What we collect",
    body: (
      <ul>
        <li>
          Account details: full name, BHW ID number, purok/area, e-mail address, mobile number,
          optional home address, profile photo.
        </li>
        <li>
          Attendance details: date and time of each time-in and time-out, the attendance station
          used, the scan result, and your phone&apos;s location and GPS accuracy{" "}
          <strong>at the moment you scan</strong> (not at any other time).
        </li>
        <li>
          Phone details: a one-way hashed code of your app installation, phone platform and model.
          We cannot recover your phone&apos;s real identifier from it.
        </li>
        <li>Optional: a selfie taken during scanning, only if the office turns this feature on.</li>
        <li>Correction requests you file, including any attachment.</li>
      </ul>
    ),
  },
  {
    id: "what-we-do-not-collect",
    heading: "What we do NOT collect",
    body: (
      <p>
        We do not collect fingerprints, face templates or any biometric data. If you use your
        phone&apos;s fingerprint or Face ID to unlock the scan screen, that check happens only on
        your phone and nothing is sent to us. We do not track your location outside of scanning.
      </p>
    ),
  },
  {
    id: "why",
    heading: "Why we collect it",
    body: (
      <p>
        To record your attendance, compute lateness and undertime based on your approved schedule,
        prepare your Daily Time Record (CSC Form No. 48) and attendance reports, prevent fraudulent
        attendance, and keep an audit trail of changes.
      </p>
    ),
  },
  {
    id: "legal-basis",
    heading: "Legal basis",
    body: (
      <p>
        Your consent, and the barangay&apos;s legal obligation and function to monitor the
        attendance of its personnel (RA 10173, Sections 12 and 13).
      </p>
    ),
  },
  {
    id: "who-can-see",
    heading: "Who can see it",
    body: (
      <p>
        The BHW Office administrator(s); Barangay management can see reports and dashboards only (no
        locations or contact details). Your contact number and address are encrypted and visible
        only to you and the administrator. We do not sell or share your data with anyone else,
        except when required by law.
      </p>
    ),
  },
  {
    id: "how-long",
    heading: "How long we keep it",
    body: (
      <p>
        Attendance records, correction requests and audit logs: 5 years. Scan attempt logs: 1 year.
        Selfies: 30 days. Error logs: 180 days. Rejected registrations: 90 days after rejection. See
        the full retention schedule with the DPO.
      </p>
    ),
  },
  {
    id: "protection",
    heading: "How we protect it",
    body: (
      <p>
        Encrypted connections (HTTPS) everywhere; encrypted storage of contact number and address;
        private file storage with short-lived links; role-based access; audit trail of every change;
        regular backups.
      </p>
    ),
  },
  {
    id: "rights",
    heading: "Your rights",
    body: (
      <p>
        You may ask to access, correct or (where the law allows) delete your personal data, object
        to processing, withdraw consent, and file a complaint with the National Privacy Commission (
        {NPC}). Withdrawing consent means you can no longer use the QR attendance system; your
        attendance will then be recorded manually by the administrator. Requests are answered within
        15 days. Contact the DPO above.
      </p>
    ),
  },
  {
    id: "breach",
    heading: "Data breach",
    body: (
      <p>
        If a breach affecting your data happens, we will notify you and the National Privacy
        Commission within 72 hours of discovery.
      </p>
    ),
  },
];

export const PRIVACY_FIL: readonly Section[] = [
  {
    id: "sino-kami",
    heading: "Sino kami",
    body: (
      <p>
        Ang Barangay Kalawag II Health Workers (BHW) Office ang personal information controller ng
        system na ito. Data Protection Officer: {DPO_CONTACT.name.fil}, {DPO_CONTACT.email},{" "}
        {DPO_CONTACT.phone.fil}, Barangay Hall, Kalawag II, Isulan, Sultan Kudarat.
      </p>
    ),
  },
  {
    id: "kinokolekta",
    heading: "Ano ang kinokolekta namin",
    body: (
      <ul>
        <li>
          Detalye ng account: buong pangalan, BHW ID number, purok/lugar, e-mail, mobile number,
          home address (opsyonal), larawan.
        </li>
        <li>
          Detalye ng attendance: petsa at oras ng bawat time-in at time-out, ang station na ginamit,
          resulta ng scan, at lokasyon ng iyong telepono at linaw ng GPS{" "}
          <strong>sa mismong oras lamang ng pag-scan</strong>.
        </li>
        <li>
          Detalye ng telepono: isang naka-hash na code ng iyong app installation, platform at model
          ng telepono. Hindi na namin makukuha mula rito ang tunay na identifier ng iyong telepono.
        </li>
        <li>Opsyonal: selfie habang nag-i-scan, kung bubuksan ng opisina ang feature na ito.</li>
        <li>Mga correction request na iyong isinusumite, kasama ang attachment.</li>
      </ul>
    ),
  },
  {
    id: "hindi-kinokolekta",
    heading: "Ang HINDI namin kinokolekta",
    body: (
      <p>
        Hindi kami kumukuha ng fingerprint, face template o anumang biometric data. Kung gagamitin
        mo ang fingerprint o Face ID ng iyong telepono para buksan ang scan screen, sa telepono mo
        lamang ito nangyayari at walang ipinapadala sa amin. Hindi namin sinusubaybayan ang iyong
        lokasyon maliban sa oras ng pag-scan.
      </p>
    ),
  },
  {
    id: "bakit",
    heading: "Bakit namin ito kinokolekta",
    body: (
      <p>
        Upang maitala ang iyong attendance, makwenta ang pagka-late at undertime batay sa iyong
        aprubadong schedule, maihanda ang iyong Daily Time Record (CSC Form No. 48) at mga ulat,
        maiwasan ang pandaraya sa attendance, at magkaroon ng talaan ng lahat ng pagbabago.
      </p>
    ),
  },
  {
    id: "batayang-legal",
    heading: "Batayang legal",
    body: (
      <p>
        Ang iyong pahintulot, at ang tungkulin ng barangay na subaybayan ang attendance ng mga
        tauhan nito (RA 10173, Seksyon 12 at 13).
      </p>
    ),
  },
  {
    id: "sino-makakakita",
    heading: "Sino ang makakakita",
    body: (
      <p>
        Ang administrator ng BHW Office; ang pamunuan ng Barangay ay makakakita lamang ng mga ulat
        at dashboard (walang lokasyon o contact details). Ang iyong mobile number at address ay
        naka-encrypt at ikaw at ang administrator lamang ang makakakita. Hindi namin ibinebenta o
        ibinabahagi ang iyong datos, maliban kung hinihingi ng batas.
      </p>
    ),
  },
  {
    id: "gaano-katagal",
    heading: "Gaano katagal namin itatago",
    body: (
      <p>
        Attendance records, correction request at audit log: 5 taon. Talaan ng scan attempts: 1
        taon. Selfie: 30 araw. Error logs: 180 araw. Na-reject na rehistro: 90 araw matapos
        ma-reject.
      </p>
    ),
  },
  {
    id: "proteksyon",
    heading: "Paano namin ito pinoprotektahan",
    body: (
      <p>
        Naka-encrypt na koneksyon (HTTPS); naka-encrypt na pag-iimbak ng mobile number at address;
        pribadong file storage na may panandaliang link; access batay sa tungkulin; talaan ng bawat
        pagbabago; regular na backup.
      </p>
    ),
  },
  {
    id: "karapatan",
    heading: "Ang iyong mga karapatan",
    body: (
      <p>
        Maaari mong hilingin na makita, itama o (kung pinapayagan ng batas) burahin ang iyong
        personal na datos, tumutol sa pagproseso, bawiin ang pahintulot, at magreklamo sa National
        Privacy Commission ({NPC}). Kapag binawi mo ang pahintulot, hindi mo na magagamit ang QR
        attendance system; itatala na lamang nang mano-mano ng administrator ang iyong attendance.
        Sasagutin ang mga kahilingan sa loob ng 15 araw. Makipag-ugnayan sa DPO.
      </p>
    ),
  },
  {
    id: "data-breach",
    heading: "Data breach",
    body: (
      <p>
        Kung magkaroon ng breach na may kinalaman sa iyong datos, aabisuhan ka namin at ang National
        Privacy Commission sa loob ng 72 oras mula nang matuklasan ito.
      </p>
    ),
  },
];
