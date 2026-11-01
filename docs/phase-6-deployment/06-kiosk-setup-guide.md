> **Role speaking: Frontend Designer / Developer** (with the System Administrator for hardware, power and network)

# 06 – Kiosk / QR Station Setup Guide

**BHW QR Attendance System – Barangay Kalawag II Health Workers Office, Isulan, Sultan Kudarat**

The **kiosk** is a screen at the office that shows a **QR code that changes every 15 seconds**. BHWs scan it with the BHW Attendance app to time in and time out. The kiosk is just a web page (`/kiosk`) open in a browser. There is nothing to install on it except the browser.

Replace `https://<portal-address>` with the barangay's real portal address *(operator-supplied, filled in by the System Administrator at go-live)*.

## Contents

1. [What you need](#1-what-you-need)
2. [Choose the place](#2-choose-the-place)
3. [Record the station coordinates](#3-record-the-station-coordinates)
4. [Create and link the kiosk account](#4-create-and-link-the-kiosk-account)
5. [Open the kiosk page](#5-open-the-kiosk-page)
6. [Make it full-screen and locked (Android)](#6-make-it-full-screen-and-locked-android)
7. [Using a small PC and monitor instead](#7-using-a-small-pc-and-monitor-instead)
8. [Keep the screen on and restart after a power loss](#8-keep-the-screen-on-and-restart-after-a-power-loss)
9. [Brightness and position for scanning](#9-brightness-and-position-for-scanning)
10. [What the kiosk screen shows](#10-what-the-kiosk-screen-shows)
11. [Heartbeat and Device Health](#11-heartbeat-and-device-health)
12. [Daily checks](#12-daily-checks)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. What you need

| Item | Recommended | Notes |
| --- | --- | --- |
| Screen | **Android tablet, 10 inches or larger** (Android 10 or newer, 3 GB RAM or more) **or** a small PC (mini PC or old laptop) with a monitor of 19 inches or larger | A larger screen lets BHWs scan from farther away and reduces the queue. |
| Browser | **Google Chrome** (latest version) | Chrome supports the full-screen button and keeps the screen awake. |
| Mount | Wall bracket or desk stand, lockable if possible | The screen must not move after setup. |
| Power | Wall outlet with the original charger, cable tidy and fixed | Use a charger that keeps the tablet at 100% while the screen is on. |
| Internet | Office **Wi-Fi**, or a **mobile data** SIM / pocket Wi-Fi | About 1–2 MB per hour. A prepaid data promo is enough. |
| UPS (optional) | Small UPS (600 VA) for a PC kiosk and the Wi-Fi router | A tablet has its own battery; the router still needs power during brownouts. |
| Admin phone or laptop | Signed in to the admin portal | Used once to record the station coordinates. |

> The kiosk does **not** need a camera, GPS or a correct clock. The BHW's phone does the scanning and the location check; the server keeps the time.

---

## 2. Choose the place

The BHW's **phone** must get a good GPS location while standing in front of the kiosk. The system accepts a scan only when:

- the phone's GPS accuracy is **50 m or better**, and
- the phone is within **100 m** of the station's saved coordinates (both values can be changed in **Settings**).

Choose a place that is:

1. **Near the entrance, a door or a large window**, on the ground floor if possible. Thick concrete walls and metal roofs weaken GPS.
2. **Inside, protected from rain and direct sun.** Sunlight on the screen makes the QR hard to read.
3. **With space for a short line** of people, so nobody blocks the door.
4. **In view of office staff**, so nobody can take the tablet or cover the screen.
5. **Near a power outlet** and with a good Wi-Fi or mobile signal.

**Test before you mount anything:** ask one BHW to stand at the spot, open the app and tap **Scan**. The **Before you scan** sheet shows the live **GPS accuracy** in metres. If it stays above 50 m after 30 seconds, choose a spot closer to a door or window.

---

## 3. Record the station coordinates

Do this **standing exactly where the kiosk will be**.

1. On a phone (better GPS than most laptops), open `https://<portal-address>/login` in Chrome and sign in as **admin**.
2. Go to **Stations & Kiosks** → **New station** (or click the edit icon of an existing station).
3. Type the **Name**, e.g. "BHW Office – Main Entrance".
4. Turn on the phone's Location, wait 20–30 seconds, then click **Use my location**. Allow location when Chrome asks.
5. Click **Check on OpenStreetMap** and confirm the pin is on the office.
6. If the pin is wrong, type the **Latitude** and **Longitude** yourself. In Google Maps, press and hold on the office building; the two numbers appear at the top (for example `6.633012, 124.604871`). The first number is the latitude.
7. Leave **Geofence radius (m, optional)** blank to use the default (100 m). Use a bigger radius only if BHWs scan from a wide compound.
8. Keep **Active** on and click **Create station** (or **Save changes**).

> A laptop without GPS guesses its location from Wi-Fi and can be off by hundreds of metres. Always check the pin on the map.

---

## 4. Create and link the kiosk account

Each tablet signs in with its **own kiosk account**. Do not use an admin account on the kiosk: the screen will show "**Admin preview – heartbeats are not sent**" and Device Health will show the kiosk as offline.

1. Admin portal → **Employees** → **Staff accounts** tab → **Add staff account**.
2. **Full name**: e.g. "Kiosk – Main Entrance". **Email**: an address the office controls, e.g. `kiosk1@<office-email-domain>` *(operator-supplied)*. **Role**: **Kiosk**. **Temporary password**: a strong password.
3. Save, and write the e-mail and password in the office's locked password record.
4. Go to **Stations & Kiosks** → edit the station → **Kiosk account** → choose the new account → **Save changes**.

One kiosk account per station. A kiosk account can only show the QR for its own station; it cannot see attendance records.

---

## 5. Open the kiosk page

1. On the tablet, connect to Wi-Fi (or insert the data SIM).
2. Open **Chrome** and go to `https://<portal-address>/login`.
3. Sign in with the **kiosk account**. Chrome may offer to save the password: choose **Save**, so the kiosk can sign in again quickly.
4. You are taken to `/kiosk` and then **straight to your station's QR screen** (`/kiosk/<station-id>`).
5. Tap the **full-screen button** at the top right (or press **F** on a keyboard) to hide the browser bar.

If you see one of these notices instead of a QR:

| Notice | Fix |
| --- | --- |
| "This kiosk account has no active station" | Link the account to a station (section 4) and make sure the station is **Active**. |
| "This kiosk is not linked to this station" | You opened another station's link. Tap **Choose another station** or link this account in **Stations & Kiosks**. |
| "*Station name* is inactive" | Turn **Active** on for the station in **Stations & Kiosks**. |

The kiosk stays signed in. You do not need to sign in every day unless someone signs out or clears Chrome's data.

---

## 6. Make it full-screen and locked (Android)

Pick **one** of the options below.

### Option A – Chrome + Home screen shortcut + App pinning (free, recommended)

1. In Chrome, on the kiosk QR screen, tap the **⋮** menu → **Add to Home screen** → **Add**. A "BHW" shortcut appears on the home screen.
2. Turn on **App pinning** (also called **Screen pinning** or **Pin windows**): **Settings → Security** (or **Security & privacy → More security settings**) → **App pinning** → On. Also turn on **Ask for PIN before unpinning**.
3. Open the kiosk from the shortcut. Tap the **full-screen button** on the kiosk page.
4. Open **Recent apps** (the square button or swipe up and hold), tap the Chrome icon at the top of its card, and choose **Pin** (or **Pin this app**).
5. Now nobody can leave Chrome without the tablet PIN. To unpin, hold **Back + Recent apps** (or swipe up and hold) and enter the PIN.

> Menu names differ a little between Samsung, Xiaomi, Realme, Lenovo and other brands. Search "pin" in the Settings search box if you cannot find it.

### Option B – Fully Kiosk Browser (optional)

Fully Kiosk Browser is an Android app (from the Play Store) made for kiosks. It can open one web page on start-up, keep the screen on, restart after a power loss and block other apps. Some kiosk-lock features need a paid licence; check the current terms on the developer's website before buying.

1. Install **Fully Kiosk Browser** from the Play Store.
2. In its settings set the **Start URL** to `https://<portal-address>/login`.
3. Turn on the options for **launch on boot**, **keep screen on** and **kiosk mode** (exact names depend on the version).
4. Open the app, sign in with the kiosk account, and confirm the QR screen appears.
5. Set an **exit PIN** and write it in the office's locked password record.

---

## 7. Using a small PC and monitor instead

1. Install Google Chrome. Set Windows to **never sleep** (Settings → System → Power → Screen and sleep → **Never**).
2. Sign in to the kiosk page once in Chrome (section 5) so the login is saved.
3. Create a shortcut with this target (one line):
   `"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk https://<portal-address>/kiosk`
4. To start it automatically, press **Windows + R**, type `shell:startup`, press Enter, and copy the shortcut into that folder.
5. Set Windows to sign in automatically, or use a local account with no password for this PC only (ask the System Administrator).
6. In the PC's BIOS/UEFI, set **Restore on AC power loss** (or **After power failure**) to **Power On**, so the PC starts again after a brownout.
7. To exit kiosk mode, press **Alt + F4**.

---

## 8. Keep the screen on and restart after a power loss

**Screen on.** The kiosk page asks the browser to keep the screen awake while it is open. As a backup:

- Android: **Settings → Display → Screen timeout** → the longest value (for example 30 minutes).
- Android (extra): **Developer options → Stay awake** (screen never sleeps while charging). To show Developer options: Settings → About tablet → tap **Build number** 7 times.
- Turn **off** battery saver / power saving mode for Chrome (Settings → Apps → Chrome → Battery → **Unrestricted**).

**After a power loss.**

| Device | What to set |
| --- | --- |
| Android tablet | The tablet stays on with its battery. If it shuts down, many tablets turn on when the charger is connected; some have **Scheduled power on/off** in Settings. After it starts, open the shortcut (Option A) or let Fully Kiosk start by itself (Option B). |
| Mini PC | BIOS **Restore on AC power loss → Power On** + the Startup shortcut (section 7). |
| Wi-Fi router | Put it on the UPS if you have one. The kiosk reconnects by itself when the internet returns. |

You do **not** need to set the tablet's clock. The kiosk clock on screen comes from the server. If the tablet clock is wrong, a yellow "**Clock drift**" badge appears; it does not affect attendance, but you may turn on **Automatic date & time** to remove it.

---

## 9. Brightness and position for scanning

- **Height:** centre of the screen at about **chest to eye level (1.2–1.5 m from the floor)**.
- **Angle:** straight or tilted slightly down. Avoid lights or windows reflecting on the screen; check by looking from where BHWs will stand.
- **Brightness:** **80–100%**, with **auto-brightness off**.
- **Orientation:** either works. Lock it (turn off auto-rotate) so the layout does not jump.
- **Distance:** BHWs should hold the phone about **20–40 cm** from the screen.
- Keep the screen clean. Wipe it weekly with a dry soft cloth.
- The kiosk page is always dark with the QR on a white card, which phone cameras read easily. There is nothing to change.

---

## 10. What the kiosk screen shows

| Part | Meaning |
| --- | --- |
| Header | "BHW QR Attendance · Barangay Kalawag II" and the station name |
| Clock and date | Philippine time from the server, with the day in English and Filipino |
| QR code | Changes every **15 seconds**; each code is valid for 30 seconds |
| Countdown bar | "**New code in *N* s** / Bagong code sa *N* s" |
| Instruction | "Open the BHW Attendance app and scan this code / Buksan ang BHW Attendance app at i-scan ang code na ito" |
| **Recent scans** | First names and Time-in (Pumasok) / Time-out (Umuwi) of the latest scans (updates within about 5 seconds) |
| Status badge (bottom) | "**Online · Konektado**" or "**Offline · Walang koneksyon**" |
| Version (bottom right) | The kiosk app version, also shown in Device Health |

### The offline banner

When the kiosk loses the internet, a **red banner** appears at the top:

> **Offline – scans cannot be recorded**
> Walang koneksyon – hindi maitatala ang mga scan

What it means:

- No new QR code can be made. When the last code expires (within 30 seconds) the QR is hidden and the screen shows "**QR code unavailable – reconnecting…**". This is on purpose: an old code would be rejected anyway.
- BHW scans **cannot** be recorded through the kiosk during this time. The app does not save scans for later.
- **Do nothing on the kiosk**: when the internet returns, it gets a new QR and reports to the server at once.
- Meanwhile, the admin records BHWs with **Fallback Scan** (their personal QR) or writes the times in the logbook for **Manual entry** later.

---

## 11. Heartbeat and Device Health

- Every **60 seconds** the kiosk sends a "heartbeat" to the server with its version, clock difference and the time of its last QR code.
- If **3 heartbeats in a row** are missed (about 3 minutes), the station is marked **Offline**:
  - the admin **Dashboard** shows the **Offline kiosks** alert,
  - **Device Health** shows a red banner and the station card turns **Offline**,
  - **Error Logs** gets a **Critical** entry.
- The station turns **Online** again at its next heartbeat. A "Kiosk connection restored" warning is logged with how long it was down.
- **Never connected** means the kiosk account has never opened the QR screen. Do sections 4–5.

---

## 12. Daily checks

**Every morning before the first BHW arrives (about 07:30):**

1. The screen is on and shows a QR code.
2. The QR changes and the countdown moves ("New code in … s").
3. The bottom badge says **Online · Konektado**.
4. The clock on the kiosk matches the time on your phone (within a minute).
5. One BHW scans; their name appears under **Recent scans** within a few seconds.

**Once a day in the admin portal:** **Device Health** shows the kiosk **Online**, with no clock-drift warning and no unusual pile of failed scans.

**Weekly:** wipe the screen, check the cable and mount, and check that Chrome (or Fully Kiosk) is up to date.

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Red "Offline – scans cannot be recorded" banner | No internet on the tablet | Check Wi-Fi / mobile data and load. Restart the router. The kiosk recovers by itself. Use **Fallback Scan** meanwhile. |
| "QR code unavailable – reconnecting…" stays for long | Same as above, or the server is down | Check the internet. If the internet works, check **Error Logs** and tell the System Administrator. |
| Spinning "Preparing QR code…" never ends | Slow connection or blocked by the network | Reload the page. Try mobile data instead of the office Wi-Fi. |
| Login page appears on the kiosk | Session ended or Chrome data was cleared | Sign in again with the **kiosk** account. |
| "Admin preview – heartbeats are not sent" | Signed in as admin | Sign out, sign in with the kiosk account. |
| "This kiosk account has no active station" | Not linked, or station inactive | **Stations & Kiosks** → link the **Kiosk account** and turn **Active** on. |
| Screen turns off or dims | Screen timeout / battery saver | Section 8: longest timeout, **Stay awake**, Chrome battery **Unrestricted**. |
| Browser bar is visible | Full-screen not on | Tap the full-screen button on the kiosk page, or use Option A/B. |
| Someone left the kiosk page | App pinning not on | Turn on **App pinning** with PIN (Option A). |
| Kiosk does not come back after a brownout | No auto-start | Section 8. For PCs, BIOS **Restore on AC power loss**. |
| Yellow "Clock drift" badge | Tablet clock is wrong | No effect on attendance. Turn on **Automatic date & time**. |
| Many BHWs get "location is not accurate enough" | Kiosk too deep inside the building | Move it near a door/window (section 2). As a last step, raise **Worst GPS accuracy accepted** slightly in Settings. |
| Many BHWs get "You are about *N* m from the office" | Wrong station coordinates | Record the coordinates again at the kiosk spot (section 3). |
| BHWs get "This QR code has expired" often | Glare or slow phones; scanning takes too long | Lower glare, raise brightness, ask BHWs to hold the phone steady at 20–40 cm. |
| Phones cannot read the QR at all | Reflection, dirty screen, low brightness | Clean the screen, brightness 80–100%, change the angle. |
| **Recent scans** list does not update | Connection was briefly lost | Wait 5–10 seconds; reload the page if it stays stuck. |
| Device Health says **Never connected** | The kiosk QR screen was never opened with the kiosk account | Sections 4–5. |

Related documents: [Administrator manual](./05-admin-manual.md) · [BHW quick guide](./07-bhw-quick-guide.md) · [Deployment](./03-deployment.md) · [Operations](./04-operations.md)
