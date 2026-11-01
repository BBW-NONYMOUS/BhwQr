> **Role speaking: System Analyst** (screen names and button labels checked by the Frontend Designer / Developer against the web portal)

# 05 – Administrator Manual

**BHW QR Attendance System – Barangay Kalawag II Health Workers Office, Isulan, Sultan Kudarat**

This manual is for the person who runs the system day to day: the **administrator**. It explains every page of the admin portal in plain steps. Words in **bold** are the exact names of menus, buttons and fields on the screen.

**Before you start**

- The portal address is `https://<portal-address>` *(operator-supplied: the System Administrator writes the barangay's real web address here at go-live)*.
- All times on every screen, report and DTR are **Philippine time (Asia/Manila)**. The system uses the server's clock, never the clock of a phone or tablet.
- Every change you make is saved in the **Audit Log** with your name. Many actions ask for a **reason of at least 10 characters**. Write a real reason; it may be read in an audit later.
- Use a computer or tablet with Chrome or Edge. Keep the browser up to date.

## Contents

1. [Logging in](#1-logging-in)
2. [Dashboard](#2-dashboard)
3. [Approving or rejecting registrations](#3-approving-or-rejecting-registrations)
4. [Managing employees](#4-managing-employees)
5. [Schedules and holidays](#5-schedules-and-holidays)
6. [Stations & Kiosks](#6-stations--kiosks)
7. [Attendance records and manual entry](#7-attendance-records-and-manual-entry)
8. [Correction requests](#8-correction-requests)
9. [Fallback scan with the personal QR](#9-fallback-scan-with-the-personal-qr)
10. [Printing the DTR (CSC Form No. 48)](#10-printing-the-dtr-csc-form-no-48)
11. [Reports](#11-reports)
12. [Device Health and an offline kiosk](#12-device-health-and-an-offline-kiosk)
13. [Error Logs and Audit Log](#13-error-logs-and-audit-log)
14. [Settings](#14-settings)
15. [Staff accounts (admin, kiosk, viewer)](#15-staff-accounts-admin-kiosk-viewer)
16. [Your privacy duties (RA 10173)](#16-your-privacy-duties-ra-10173)
17. [The end-of-day job and other automatic jobs](#17-the-end-of-day-job-and-other-automatic-jobs)
18. [Troubleshooting](#18-troubleshooting)

### The admin menu (left sidebar)

| Group | Menu items |
| --- | --- |
| Overview | **Dashboard** |
| People | **Employees**, **Pending Approvals** (badge = registrations waiting) |
| Attendance | **Attendance Records**, **Correction Requests** (badge = requests waiting), **Fallback Scan**, **DTR (CSC Form 48)**, **Reports** |
| Setup | **Schedules**, **Holidays**, **Stations & Kiosks**, **Settings** |
| Monitoring | **Device Health** (badge = offline kiosks), **Error Logs**, **Audit Log** |

Your name is at the bottom of the sidebar. Click it to change the theme (**Light**, **Dark**, **System**) or to **Sign out**.

---

## 1. Logging in

1. Open `https://<portal-address>/login`.
2. Enter your **Email** and **Password**, then click **Log in**.
3. You land on the **Dashboard**.

| Problem | What to do |
| --- | --- |
| Forgot the password | Click **Forgot password?** on the login page. A reset link is sent to your e-mail. |
| "Email or password is incorrect" | Check Caps Lock and the e-mail spelling. After a few tries, use **Forgot password?**. |
| You are sent to another page (not the admin portal) | Your account is not an admin account. Ask the System Administrator. |

> Always click **Sign out** when you leave a shared computer.

---

## 2. Dashboard

The Dashboard shows **today** only. The page header says the date and "all times in Manila time".

### Live updates

At the top right you see a small status label:

| Label | Meaning |
| --- | --- |
| **Live** | The dashboard updates by itself within about 2 seconds of each scan. |
| **Connecting…** | It is reconnecting. Wait a few seconds. |
| **Offline** | Live updates stopped. Reload the page (press F5). |

**Updated HH:mm** shows when the numbers were last loaded. The round-arrow button (**Refresh now**) reloads them at once.

### Stat cards

| Card | What it counts |
| --- | --- |
| **Present** | Employees who timed in today (on time + late + undertime + no time-out). The small line shows how many were on time and the percent of all employees. |
| **Late** | Timed in after the grace period. |
| **Absent** | Marked absent for today. Note: absences are written by the end-of-day job the **next morning** (section 17), so during the day this is usually 0. |
| **Undertime** | Timed out before the end of their shift. |
| **No time-out** | Timed in but have not timed out yet. |
| **Total employees** | All active employees. The small line "*N* scheduled today, not yet scanned" is the "No record yet" count. |

### Alert cards

| Card | When it needs you | Where to go |
| --- | --- | --- |
| **Pending approvals** | "Registrations waiting for review" | **Pending Approvals** |
| **Correction requests** | "Requests waiting for a decision" | **Correction Requests** |
| **Offline kiosks** | "Missed 3 heartbeats - check Device Health" | **Device Health** (section 12) |
| **Critical errors (24 h)** | "Review in Error Logs" | **Error Logs** (section 13) |

### Other sections

- **Last 7 days**: bar chart of records per day by status.
- **Live scans**: the latest successful kiosk scans today.
- **Today's attendance**: one row per active employee with **Status**, **Time in**, **Time out**, **Undertime**, **Method** and **Station**. "Not yet scanned" means no record yet. Use the search box or **Export CSV**.

---

## 3. Approving or rejecting registrations

BHW staff register themselves at `https://<portal-address>/register`. A registration shows in **Pending Approvals** only **after the person clicks the verification link** in their e-mail.

### Approve

1. Open **Pending Approvals**. Each card shows the photo, name, BHW ID number, purok/area, e-mail and the date of Data Privacy consent.
2. Check the details against the barangay roster of BHWs.
3. Click **Approve**.
4. Choose the **Schedule** and the **Effective from** date.
5. Click **Approve**. The account becomes active and the BHW gets an e-mail and an in-app notice. They can now log in to the app.

> You cannot approve without a schedule. Create schedules first (section 5).
>
> You also cannot approve without a profile photo (BR-12a). A card without one shows **Waiting for a profile photo** and a disabled **Approve** button: the BHW adds the photo on their "waiting for approval" page (or on their own page later). In **Employees**, a **No photo** label marks anyone still missing one.

### Reject

1. Click **Reject**.
2. Type the **Reason for rejection** (at least 10 characters), for example "BHW ID number not found in the barangay roster."
3. Click **Reject registration**.

The person sees your reason on the website, in the app and by e-mail. A rejected registration is **deleted automatically after 90 days**. If they fix their details, they can register again after that, or sooner if their old record is deleted on request (section 16).

---

## 4. Managing employees

Open **Employees**. There are two tabs: **BHW employees** and **Staff accounts** (section 15). Filter by status (**All statuses**) or area (**All areas**), or search by name, e-mail or BHW ID. Click a name to open the profile.

The profile shows the details, the **phone** (device) card, the **schedule** history and **Recent attendance** (with a **View DTR** button).

| Task | Steps | Notes |
| --- | --- | --- |
| **Edit profile** | Click **Edit profile** → change **Full name**, **BHW ID number** or **Purok / area** → save. | Saved in the Audit Log. The contact number and address are encrypted and shown only to admins and the employee. |
| **Deactivate** (BHW stops working) | Click **Deactivate** → type the **Reason for deactivation** → **Deactivate account**. | They cannot log in, scan or show a personal QR, and are **not** marked absent. Their records and phone binding are kept. |
| **Reactivate** | Click **Reactivate** → **Reactivate account**. | They can scan again right away. |
| **Reset device** (new, lost or broken phone; app reinstalled) | Click **Reset device** → type the **Reason for reset**, e.g. "Lost phone, replaced with a new unit." → **Reset device**. | The old phone stops working for attendance at once. The **next phone the BHW logs in with** becomes their attendance phone. They are notified. |
| **Assign schedule** | In the schedule card click **Assign schedule** → choose the **Schedule** and **Effective from** → **Assign schedule**. | The old assignment ends the day before. Past days are **not** changed; use **Recompute statuses** if needed (section 5.3). |

> **Why "Reset device" is needed:** each BHW can use only **one phone**. Reinstalling the app or clearing its data counts as a new phone. Before you reset, confirm the request in person or by a call, so nobody can move someone else's attendance to their own phone.

---

## 5. Schedules and holidays

### 5.1 Schedules

A schedule tells the system the work days, office hours, lunch break and grace period. It is used to decide **on time**, **late**, **undertime** and **absent**.

1. Open **Schedules** → **New schedule**.
2. Fill in **Name** (e.g. "Regular Mon–Fri 8–5"), tick the **Work days**, set **Start time**, **End time**, **Break start**, **Break end** and **Grace period (minutes)** (0–60).
3. Click **Create schedule**.

How the rules work (example: 08:00–17:00, grace 15 minutes):

| Time-in | Result |
| --- | --- |
| 07:45 or 08:10 or 08:15 | On time |
| 08:16 | Late, **16 minutes** (counted from 08:00, not from 08:15) |

| Time-out | Result |
| --- | --- |
| 16:30 | Undertime, 30 minutes |
| 17:00 or later | No undertime |

- A schedule that is or was ever assigned cannot be deleted ("Assigned schedules cannot be deleted"). Create a new one instead.
- An active employee with **no schedule** can still scan; the record is saved as on time with the note "No schedule assigned" and no absences are counted. Assign a schedule soon.

### 5.2 Holidays

1. Open **Holidays** and choose the **Year**.
2. Click **Add *year* PH regular holidays** to load the national regular holidays, or **Add holiday** for a local or special day (e.g. "Isulan Founding Anniversary").
3. To remove one, click the remove icon on its row.

On a holiday nobody is marked absent. Anyone who scans gets no late or undertime, and the DTR shows the holiday name. **Add holidays before the date** whenever you can.

### 5.3 When to use **Recompute statuses**

Changes to schedules and holidays apply **only to new scans**. Past records keep the status they had. Use **Recompute statuses** when you need a change to apply to past dates:

| Situation | Where to click |
| --- | --- |
| A holiday was declared **after** the date (people were already marked absent) | **Holidays** → **Recompute statuses** (the page also offers **Recompute** right after you add a holiday) |
| You edited a schedule that employees already use, and the change should apply to earlier days | **Schedules** → **Recompute statuses** |
| One employee's records look wrong after a schedule change | **Attendance Records** → **Recompute statuses**, choose that **Employee** |

Steps: choose **From** and **To** (at most one year) → click **Recompute**. The times themselves are **never** changed; only on time / late / undertime / absent are recalculated. Absent marks on new holidays are removed. The recompute is audited.

---

## 6. Stations & Kiosks

A **station** is the place where a kiosk screen stands (for example the BHW office entrance). Phones must be within the station's **geofence** (default 100 m) for a scan to count.

1. Stand at the place where the kiosk will be, with a phone or laptop signed in to the admin portal.
2. Open **Stations & Kiosks** → **New station**.
3. Type the **Name**, e.g. "BHW Office – Main Entrance".
4. Click **Use my location** (allow location when the browser asks). Check the pin with **Check on OpenStreetMap**. If it is wrong, type the **Latitude** and **Longitude** yourself (for example from Google Maps: press and hold on the spot).
5. Leave **Geofence radius (m, optional)** blank to use the default from Settings, or type a radius.
6. Choose the **Kiosk account** that will sign in on the tablet (create it first, section 15).
7. Keep **Active** on and click **Create station**.

The table shows each station's **Status** (Online / Offline / Never connected / Inactive), **Last seen** and an **Open kiosk** link. Full tablet setup is in [06-kiosk-setup-guide.md](./06-kiosk-setup-guide.md).

> Turning a station off (**Active** off) stops its QR codes. Scans of an old code then fail with "This attendance station is not active".

---

## 7. Attendance records and manual entry

Open **Attendance Records** to see every time-in and time-out. Filter by **Date range** (click **Apply**), **Employee**, **Status** and **Method**, or click **Reset filters**. **Export CSV** downloads what you see.

The **Method** badge tells how the record was made:

| Method | Meaning |
| --- | --- |
| **Kiosk QR** | The BHW scanned the kiosk with the app. |
| **Fallback (personal QR)** | You scanned the BHW's personal QR on **Fallback Scan**. |
| **Manual entry** | You typed the times. |
| **Approved correction** | A correction request was approved. |

### Manual entry

Use it **only** when the BHW could not scan the kiosk **and** could not show a personal QR (for example, the internet was down, or the phone is lost).

1. Click **Manual entry** (or **Edit times** / **Enter times** on a row).
2. Choose the **Employee** and **Work date**.
3. Type the **Time-in** and/or **Time-out**. Leave a time blank to keep what is already recorded.
4. Optional: choose the **Station**.
5. Type the **Reason** (at least 10 characters), e.g. "Kiosk offline 07:30–09:15; time taken from the office logbook".
6. Click **Save entry** (or **Save times**).

Rules:

- Dates and times **cannot be in the future**.
- Time-out must be **after** time-in. A time-out may be after midnight only until the overnight cutoff (04:00 by default).
- Late, undertime and status are recalculated from the schedule.
- The entry is **audited**: your name, the old and new times and the reason are saved in the **Audit Log**, and the record is marked "Manual entry".

> Keep the paper logbook or a note as proof whenever you use manual entry.

---

## 8. Correction requests

BHWs file a correction in the app when a time is missing or wrong. Types: **Missing time-in**, **Missing time-out**, **Wrong time**, **Official business / field work**.

1. Open **Correction Requests**. The tabs are **Pending**, **Approved**, **Rejected** and **Cancelled**. Filter by **Type** or **Employee**.
2. Click **Review** on a pending request.
3. Read the **Current record vs requested** table (**Current**, **Requested**, **After approval**), the **Reason** and the attachment (for example a logbook photo or travel order).
4. Type **Remarks**: optional when approving, **required (at least 10 characters) when rejecting**. The BHW sees your remarks.
5. Click **Approve** or **Reject**.

### What changes when you approve

- The attendance record gets the requested time(s). An "Absent" day is filled in.
- **Late, undertime and status are recalculated** from the schedule for that date.
- The method becomes **Approved correction**.
- The **DTR changes at once**, because the DTR is always built from the current records. Reprint it if you printed it before.
- The BHW is notified, and everything is audited.

For **Official business** with both times blank, the system uses the schedule's start and end time.

When you **reject**, the record does not change.

If you see "**This request cannot be approved as filed**", the request does not fit the record (for example a missing time-out on a day with no time-in). Reject it with remarks and ask the BHW to file the right type.

**Time limit for BHWs:** they can file for the current month, and for last month only during the first 5 days of the new month (see **Correction window** in Settings). After that, use **Manual entry** with a reason.

---

## 9. Fallback scan with the personal QR

Use **Fallback Scan** when a BHW is **at the office in person** but cannot scan the kiosk: kiosk offline, phone camera broken, GPS will not lock.

1. Ask the BHW to open the **My QR** tab in the app. The code changes every 15 seconds; a screenshot does not work.
2. On your computer open **Fallback Scan** and choose the **Station** where the BHW is.
3. Allow the camera. Hold the BHW's phone in front of the camera.
4. A green message "**Time-in recorded at HH:mm**" (or Time-out) confirms it.

- No camera? Click **Paste QR content instead** (for example with a USB QR reader), then **Record attendance**.
- The camera works only on the secure `https://` address.
- If the BHW cannot show a personal QR, click **Manual entry instead** and give a reason.
- The record is marked **Fallback (personal QR)**, has you as the recorder, and is audited. Location is not checked because you see the BHW in person. The 5-minute cooldown still applies.

---

## 10. Printing the DTR (CSC Form No. 48)

1. Open **DTR (CSC Form 48)**.
2. Choose the **Employee**, or **All employees (batch)** to make every DTR for the month.
3. Choose the **Month** and **Year**.
4. Check the summary: **Days present**, **Days absent**, **Days late**, **Days undertime**, **No time-out** and **Total undertime** (hours:minutes, lateness plus undertime).
5. Click **Print** or **Download PDF**.

| Print fact | Detail |
| --- | --- |
| Paper | A4, **landscape**. Each sheet has **two identical copies side by side** (one for the employee, one for the office). In the print dialog set "Margins: Default" and keep "Scale" at 100%. |
| Batch | One employee per page, every employee active during that month. |
| Undertime column | Lateness plus early departure. An absent work day counts the full scheduled hours (e.g. 8 h 0 min). |
| Lunch cells | Blank unless **Fill lunch break times on the DTR** is on in Settings. |
| Days with no scan | Weekends show the day name; holidays show the holiday name; "Absent" across an absent work day; "No time-out" for an incomplete day. |
| Signatures | The **employee** signs the "(Signature)" line under the certification. The **in-charge** (BHW coordinator or Punong Barangay, as your office decides) signs the "**In Charge**" line under "Verified as to the prescribed office hours". Sign both copies in ink. |

> Print DTRs **after** all correction requests for the month are decided, so the totals are final. Employees can download their own DTR from the app (**My DTR**).

---

## 11. Reports

1. Open **Reports** and choose a tab: **Daily**, **Weekly** or **Monthly**.
2. Choose the period: **Date** (daily), **Week starting (Monday)** (any date picks the Monday of its week), or **Month** and **Year**.
3. Optional: filter by **Area** and, on the daily report, **Status**.
4. Read the totals: **Present**, **On time**, **Late**, **Undertime**, **No time-out**, **Absent**, **No record yet**, **Total lateness**, **Total undertime**.
5. Click **Print** (barangay header, period and "Generated by" line) or **Export CSV** (opens in Excel).

- Report totals are counted directly from the attendance records, so they always match **Attendance Records**.
- **Present** counts everyone with a time-in, including "No time-out" days.
- Today's numbers are not final until the end-of-day job runs the next morning.
- Reports never include contact numbers or addresses.
- Viewer accounts (barangay management) can open the same reports, read-only.

---

## 12. Device Health and an offline kiosk

Open **Device Health**. It refreshes by itself.

| Section | What it shows |
| --- | --- |
| Red banner (only when needed) | Each offline kiosk and its last heartbeat |
| **Kiosks** | One card per station: status (**Online**, **Offline**, **Never connected**, **Inactive**), last heartbeat, **App version**, **Clock drift**, **Last QR token**, **Interval** |
| **Failed scans, last 24 hours** | Failed scans grouped by reason (for example "Phone outside the station geofence") |
| **Anomaly flags, last 7 days** | Suspicious patterns: many failed scans in 10 minutes, repeated outside-geofence or reused-QR attempts, "Mock location detected" |

Each kiosk sends a heartbeat every 60 seconds. After **3 missed heartbeats** (about 3 minutes) it is marked **Offline**, the Dashboard shows **Offline kiosks**, and a critical entry is added to **Error Logs**.

### What to do when a kiosk is offline

1. Look at the tablet. Is it on, plugged in, and showing the red "**Offline – scans cannot be recorded**" banner?
2. Check the Wi-Fi or mobile data on the tablet. Open any website to test.
3. If the screen shows the login page, sign in again with the **kiosk account**.
4. If the page is frozen, reload it (or close and reopen Chrome).
5. Meanwhile, record arriving BHWs with **Fallback Scan** (section 9). If that is not possible, write the times in the paper logbook and use **Manual entry** later with a reason.
6. When the internet returns, the kiosk reconnects by itself. Device Health shows **Online** again at its next heartbeat.

**Clock drift** above 30 seconds shows a warning. It does **not** affect attendance (the system uses server time), but turn on automatic date and time on the tablet to remove the warning.

**Anomaly flags** do not block anyone. Talk to the BHW. Common honest causes: weak GPS indoors, scanning from the parking area, or an old phone. A "Mock location detected" flag means a fake-GPS app was on; ask the BHW about it and follow your office rules.

---

## 13. Error Logs and Audit Log

### Error Logs

Shows problems reported by the server, kiosks, the mobile app and the portal, kept for 180 days. Filter by **Source**, **Severity** and date, search, and click the details icon to see the context.

| Severity | What to do |
| --- | --- |
| **Critical** | Act now: kiosk offline, end-of-day job failed. |
| **Error** | Check the same day. If it repeats, tell the System Administrator. |
| **Warning** / **Info** | For your information (for example "Kiosk connection restored", the weekly verification report). |

### Audit Log

A **read-only** list of every change to attendance, profiles, phones, corrections, schedules, stations, holidays and settings, kept for 5 years. Filter by **Table**, **Actor** and date. Click the details icon to see **Before** and **After** for each field. "System" means an automatic job did it. Encrypted fields show only "[changed]".

Use it to answer "who changed this record, when, and why?". Nobody can edit or delete audit entries.

---

## 14. Settings

Open **Settings**, change a value, then click **Save settings** (or **Discard**). Changes apply to the **next** scan; past records are not changed. Every change is audited.

| Setting | What it does (one line) | Default | Allowed | Safe range |
| --- | --- | --- | --- | --- |
| **Default geofence radius** | How far from the station (metres) a phone may be. | 100 m | 10–1000 | 50–150 m |
| **Worst GPS accuracy accepted** | Scans with a worse GPS accuracy than this are refused. | 50 m | 5–200 | 30–80 m |
| **Cooldown after a scan** | Minutes before the same BHW can scan again (stops double taps). | 5 min | 1–60 | 3–10 min |
| **Require a selfie with every scan** | Turn on only if someone scans for another person. | Off | On/Off | Off |
| **Selfie retention** | Days before selfies are deleted automatically. | 30 days | 1–365 | 7–30 days |
| **QR token lifetime** | How long one kiosk or personal QR stays valid. | 30 s | 15–120 | 30–45 s |
| **QR refresh interval** | How often a new QR appears; must be shorter than the lifetime. | 15 s | 5–60 | 10–20 s |
| **Kiosk heartbeat interval** | How often a kiosk reports in; offline after 3 missed. | 60 s | 30–300 | 60 s |
| **Overnight cutoff hour** | A scan before this hour closes the previous day (night duty). The end-of-day job runs 5 minutes after it. | 4 (04:00) | 0–6 | 3–5 |
| **Correction window** | Days into a new month when BHWs can still correct last month. | 5 days | 0–15 | 3–7 days |
| **Fill lunch break times on the DTR** | Prints the break start and end in the empty lunch cells. | Off | On/Off | As your office prefers |
| **Office name** / **Office address** | Printed on DTRs, reports and the kiosk header. | Barangay Kalawag II Health Workers Office / Barangay Kalawag II, Isulan, Sultan Kudarat | 2–150 / 2–200 characters | — |

> Change one setting at a time and write down why. If scans start failing with "outside the office" or "location not accurate enough" after a change, put the old value back.

---

## 15. Staff accounts (admin, kiosk, viewer)

BHW employees register themselves. Every other account is created by you.

1. Open **Employees** → **Staff accounts** tab → **Add staff account**.
2. Type the **Full name** and **Email**, choose the **Role**, and type a **Temporary password**.
3. Save. Give the password to the person privately and ask them to change it with **Forgot password?**.

| Role | Who | What they can do |
| --- | --- | --- |
| **Admin** | The BHW office administrator (have at least two, so one can cover leave) | Everything in this manual. |
| **Kiosk** | One account **per tablet/station** | Shows the rotating QR at `/kiosk`. Link it to a station in **Stations & Kiosks**. It cannot see attendance records. |
| **Viewer** | Punong Barangay, barangay secretary, other management | Read-only dashboard and reports; can print and export. No contact data, locations, logs or action buttons. |

To remove access (for example a staff member leaves), open the account and click **Deactivate** with a reason. You cannot deactivate your own account.

> If **Add staff account** is greyed out, the server key is not set yet. Ask the System Administrator.

---

## 16. Your privacy duties (RA 10173)

You handle personal data of barangay workers. Follow these rules:

### Who can see what

| Data | Admin | BHW (own data only) | Viewer | Kiosk |
| --- | --- | --- | --- | --- |
| Name, BHW ID, area, attendance | Yes | Own | Reports only | First name in the recent-scans list |
| Contact number, address (encrypted) | Yes | Own | No | No |
| Scan locations | Yes (Device Health, logs) | No | No | No |
| Photos, selfies, attachments | Yes (short links) | Own | No | No |
| Audit and error logs | Yes | No | No | No |

### Your duties

1. Use your own account. Never share passwords or leave the portal open.
2. Look up a BHW's data only for work.
3. Do not copy CSV files or printed DTRs to personal phones, group chats or social media. Keep printed DTRs in a locked drawer.
4. Delete exported CSV files from the computer when you are done.
5. Report a lost phone, a stolen laptop or a possible leak **right away** to the Data Protection Officer (DPO). A breach must be reported to the National Privacy Commission within 72 hours.

### Data requests from a BHW

| Request | What to do |
| --- | --- |
| "Show me my data" | The BHW can see their records, DTR and requests in the app or at `/me`. For anything else, forward to the DPO. Answer within 15 days. |
| "Correct my name/BHW ID/area" | **Edit profile** (section 4). |
| "Correct my attendance" | Ask them to file a correction request, or use **Manual entry** with a reason. |
| "Delete my data" / "I withdraw consent" | Forward to the DPO in writing. Deactivate the account. Their attendance is then recorded manually. Attendance records are kept for 5 years as required for government records; the DPO decides what can be deleted earlier, and the System Administrator does the deletion. |

The full privacy notice is at `https://<portal-address>/privacy`.

**What the system never stores:** fingerprints, face data or any biometric data. Phone fingerprint/Face ID unlock works only on the phone. Location is taken **only at the moment of a scan**.

---

## 17. The end-of-day job and other automatic jobs

The system runs jobs by itself. You do not need to start them.

| Job | When (Manila time) | What it does |
| --- | --- | --- |
| **End-of-day** | Every day at **04:05** (5 minutes after the overnight cutoff), for **yesterday** | Marks **Absent** every active, scheduled BHW with no record (not on holidays, not on non-work days, not for inactive accounts). Changes "time-in only" days to **No time-out** (incomplete) and sends the BHW a notice to file a "Missing time-out" correction. |
| Kiosk offline check | Every minute | Marks a kiosk offline after 3 missed heartbeats. |
| QR clean-up | Every hour | Removes used QR codes older than 1 day. |
| Retention clean-up | Every day 02:30 | Deletes old data on schedule (selfies 30 days, error logs 180 days, scan logs 1 year, rejected registrations 90 days, records 5 years). |
| Weekly verification | Every Monday 06:00 | Counts BHWs with no phone, no schedule, anomalies, failed scans, old pending registrations and no scans in 60 days. Read it in **Error Logs** (Info, "Weekly periodic verification report"). |

What this means for you:

- **Today's "Absent" is 0 until tomorrow morning.** Use "No record yet" on the Dashboard and the daily report during the day.
- If the end-of-day job fails, a **Critical** entry "End-of-day job failed" appears in Error Logs. Tell the System Administrator.
- A BHW who forgot to time out cannot fix it by scanning the next morning; that scan is the new day's time-in. They must file a correction.

---

## 18. Troubleshooting

### 18.1 Common problems

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| A new BHW is not in **Pending Approvals** | E-mail not verified yet | Ask them to open the verification e-mail (check Spam). They may need to register again if the link expired. |
| BHW did not get the verification or approval e-mail | E-mail is in Spam, or the e-mail service is not set up | Check Spam. If nobody gets e-mails, tell the System Administrator. |
| BHW sees "Waiting for approval" in the app | Not approved yet | Approve in **Pending Approvals**, then they tap **Check again**. |
| BHW changed phone or reinstalled the app | One phone per BHW | **Reset device** (section 4). |
| Many BHWs fail with "outside the office" | Station coordinates wrong, or radius too small | Re-check the coordinates in **Stations & Kiosks**; see the kiosk setup guide. |
| Many BHWs fail with "location not accurate enough" | Kiosk is deep inside the building | Move the kiosk near a door or window, or raise **Worst GPS accuracy accepted** a little (e.g. 50 → 70 m). |
| Everyone was marked absent on a holiday | Holiday added after the date | Add the holiday → **Recompute statuses** for that date. |
| Statuses look wrong after a schedule change | Changes apply only to new scans | **Recompute statuses** for the dates. |
| A day shows **No time-out** | BHW forgot to scan out | BHW files "Missing time-out", or you use **Manual entry**. |
| DTR totals look wrong | Pending corrections, or a day still incomplete | Decide all corrections, then reprint. |
| Kiosk shows "This kiosk account has no active station" | Kiosk account not linked | **Stations & Kiosks** → edit station → **Kiosk account**. |
| Kiosk shows "Admin preview – heartbeats are not sent" | The tablet is signed in with an admin account | Sign out and sign in with the **kiosk** account. |
| Fallback Scan camera does not start | Not on `https://`, camera used by another app, or no camera | Use the `https://` address, close other camera apps, or use **Paste QR content instead**. |
| Dashboard shows **Offline** (live updates) | Internet blip | Reload the page. |

### 18.2 Scan messages a BHW may report

The BHW sees the message in English and Filipino. Find the message here (the Filipino text is in [Phase 1 Business Rules, section 15](../phase-1-system-analysis/05-business-rules.md#15-error-code-catalog)). **Device Health → Failed scans** also shows the reason for each failure.

| Message the BHW sees (English) | Code | Cause | What you do |
| --- | --- | --- | --- |
| Your session has ended. Please log in again. | `AUTH_REQUIRED` | Logged out or session expired | BHW logs in again. |
| Too many attempts. Please wait one minute, then try again. | `RATE_LIMITED` | More than 10 tries in a minute | Wait 1 minute. |
| Something is wrong with the data sent. Please update the app and try again. | `INVALID_REQUEST` | Old app version | Update the app. If it continues, check **Error Logs**. |
| Your account is not active. Please wait for approval or contact the BHW office administrator. | `ACCOUNT_NOT_ACTIVE` | Pending, rejected or deactivated | Approve or **Reactivate** if correct. |
| This phone is not yet registered to your account. Please log in again to register it. | `DEVICE_NOT_BOUND` | No phone registered (new account or after a reset) | BHW logs out and in again on their phone; tap **Use this phone**. |
| Your account is registered to a different phone. Please ask the administrator to reset your device. | `DEVICE_MISMATCH` | New phone, borrowed phone, or app reinstalled | Confirm it is the BHW's own phone, then **Reset device**. |
| This QR code is not valid. Please scan a QR code from the BHW attendance system. | `QR_INVALID` | Scanned a wrong or fake QR | Scan the kiosk screen only. |
| This QR code has expired. Please scan the newest QR code on the screen. | `QR_EXPIRED` | Code older than 30 s: screenshot, photo, or slow scan | Scan the live screen again. Repeated cases may be cheating; check **Anomaly flags**. |
| This QR code was not issued by the office kiosk. Please scan the QR code on the kiosk screen. | `QR_UNKNOWN` | Old or copied code | Scan the live kiosk screen. |
| You have already used this QR code. Please wait for the next QR code and scan again. | `QR_REUSED` | Same code scanned twice | Wait for the next code (15 s). |
| This attendance station is not active. Please contact the administrator. | `STATION_INACTIVE` | Station switched off | Turn **Active** on in **Stations & Kiosks**, if that is correct. |
| Your location is not accurate enough (*N* m; 50 m or better is needed). Please move near a window or outside, wait a few seconds, and try again. | `GPS_INACCURATE` | Weak GPS indoors | Move near a window or door; turn on Location "High accuracy" on the phone. |
| You are about *N* m from the office. Please move closer to the BHW office (within 100 m) and scan again. | `OUTSIDE_GEOFENCE` | Phone too far from the station | Move closer. If it happens to everyone, check the station coordinates. |
| Your last scan was recorded at *HH:mm*. You can scan again at *HH:mm*. | `COOLDOWN_ACTIVE` | Scanned again within 5 minutes | Nothing is wrong; the first scan counted. |
| Your time-in and time-out for today are already recorded. If something is wrong, please file a correction request. | `ALREADY_COMPLETED` | Third scan on the same day | If the time-out was by mistake (too early), the BHW files a "Wrong time" correction. |
| A selfie is required for this scan. Please allow the front camera and try again. | `SELFIE_REQUIRED` | Selfie setting is on | Allow the front camera in the phone settings. |
| Something went wrong on our side. Please try again. If it keeps happening, please tell the administrator. | `INTERNAL_ERROR` | Server problem | Check **Error Logs**; use **Fallback Scan**; tell the System Administrator if it repeats. |
| Camera access is turned off. Please allow the camera in your phone settings so you can scan. | `CAMERA_DENIED` | Camera permission off | Phone Settings → Apps → BHW Attendance → Permissions → Camera → Allow. |
| Location access is turned off. Please allow location in your phone settings so you can scan. | `LOCATION_DENIED` | Location permission off | Same place → Location → Allow. |
| We cannot get your location. Please turn on GPS/Location and try again. | `LOCATION_UNAVAILABLE` | GPS switched off | Turn on Location in the quick settings. |
| You are offline. Please connect to the internet and scan again. Scans are not saved while offline. | `OFFLINE` | No mobile data or Wi-Fi | Connect, then scan again. Scans are never saved for later. |
| Fingerprint or Face ID check did not succeed. Please try again or use your phone's passcode. | `BIOMETRIC_FAILED` | Phone unlock check failed | Try again, use the passcode, or switch off **Fingerprint / Face unlock** in the app's Profile. |

### 18.3 When to call the System Administrator

- The portal does not open for anyone.
- **Critical** errors keep appearing in Error Logs.
- E-mails are not reaching anyone.
- You suspect someone else used your admin account.

Related documents: [Kiosk setup guide](./06-kiosk-setup-guide.md) · [BHW quick guide](./07-bhw-quick-guide.md) · [Operations](./04-operations.md) · [Business rules](../phase-1-system-analysis/05-business-rules.md)
