> **Role speaking: System Analyst**

# 06 – Process Flowcharts

This document shows the eight core processes of the BHW QR Attendance System as Mermaid flowcharts (`flowchart TD`). Each chart has a short explanation and a references line that links it to the functional requirements in [`02-functional-requirements.md`](./02-functional-requirements.md), the binding decisions in [`00-assumptions-and-decisions.md`](./00-assumptions-and-decisions.md) and the business rules in `05-business-rules.md`.

Business rules are cited by their topic name (for example "BR: time-in vs time-out decision") together with the decision ID they come from. The BR numbers themselves are kept in `05-business-rules.md`, so the links here stay correct even if that list is renumbered.

All times are Asia/Manila and come from the server clock, never from a phone or kiosk clock (FR-114).

## Notation

| Shape | Meaning |
| --- | --- |
| Rounded pill `([ ])` | Start or end of a flow |
| Rectangle `[ ]` | Action or process step |
| Diamond `{ }` | Decision (Yes / No or a named choice) |
| Dashed arrow `-.->` | Exceptional path (unexpected error, race condition, reconnect) |
| Red node | Rejection or failure result shown to the user |
| Green node | Successful end result |
| Grey node | Database write (record, log or audit row) |

## Index

| # | Flowchart | Main actors | Functional requirements | Decisions |
| --- | --- | --- | --- | --- |
| 1 | Registration and approval | Employee, Admin, System | FR-01–FR-10, FR-21–FR-26, FR-142–FR-144 | D-01, D-02, D-04, D-29, D-31, D-32, D-33 |
| 2 | Device binding on first mobile login | Employee, Admin, System | FR-27–FR-34, FR-140, FR-141 | D-01, D-05, D-06, D-07 |
| 3 | Scan to attend | Employee, Kiosk, System | FR-44–FR-61, FR-97, FR-121 | D-08–D-11, Section D, D-13–D-20 |
| 4 | Fallback (personal QR and manual entry) | Employee, Admin, System | FR-62–FR-67, FR-129 | D-12, D-14–D-19, D-28 |
| 5 | Correction request approval | Employee, Admin, System | FR-68–FR-77, FR-85, FR-142–FR-144 | D-25–D-28, D-33 |
| 6 | DTR generation | Admin, Employee, System | FR-78–FR-85 | D-19, D-22–D-24 |
| 7 | Kiosk health monitoring | Kiosk, System, Admin | FR-41, FR-100, FR-109–FR-112, FR-118, FR-119, FR-148 | D-03, D-34 |
| 8 | End-of-day job | System | FR-145, FR-146, FR-151 | D-13, D-16–D-19, D-21 |

---

## 1. Registration and approval

A BHW registers on the public `/register` page. Submission is blocked until the Data Privacy consent box is ticked and every field passes the shared zod schema. Supabase Auth then creates the account, and a trigger adds a `profiles` row with role `employee` and status `pending`. The contact number and address are encrypted, and the photo goes to the private `profile-photos` bucket. The registration appears in the admin's Pending Approvals list only after the email address is verified. The admin either approves it, which requires choosing a schedule and effective-from date and runs as one transaction, or rejects it with a required reason. Both outcomes are audited and send the registrant an in-app notification. An email is also sent when `RESEND_API_KEY` is configured. A rejected registration is deleted 90 days after rejection.

**References:** FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08, FR-21, FR-22, FR-23, FR-24, FR-26, FR-142, FR-143, FR-144 · BR: device binding/reset (an approved employee binds next), schedule changes (effective-from on approval) · D-01, D-02, D-04, D-29, D-31, D-32, D-33

```mermaid
flowchart TD
    START(["BHW opens the /register page"])
    START --> FORM["Fill in full name, BHW ID number, purok/area, contact number, optional address, email, password and profile photo"]
    FORM --> CONSENT{"Data Privacy consent box ticked?"}
    CONSENT -->|No| NOCONSENT["Submit stays disabled, consent hint shown with link to /privacy"]
    NOCONSENT --> FORM
    CONSENT -->|Yes| VALID{"zod validation passes? Required fields, email, 09XXXXXXXXX number, password of 8 or more characters, unique BHW ID and email, photo JPEG/PNG/WebP up to 5 MB"}
    VALID -->|No| FIELDERR["Show field-level errors and keep typed values"]
    FIELDERR --> FORM
    VALID -->|Yes| SIGNUP["Supabase Auth signUp"]
    SIGNUP --> PROFILE["Trigger creates profiles row: role employee, status pending, consent_at = now()"]
    PROFILE --> ENC["Encrypt contact number and address with pgcrypto and Vault key, store photo path from private profile-photos bucket"]
    ENC --> VERIFYMAIL["Supabase sends the verification email"]
    VERIFYMAIL --> CLICKED{"Verification link clicked?"}
    CLICKED -->|"Not yet"| WAITVERIFY["Sign-in routes to /pending with a 'verify your email' message"]
    WAITVERIFY --> CLICKED
    CLICKED -->|Yes| LISTED["Registration listed in Pending Approvals, oldest first, admins get an in-app notification"]
    LISTED --> DECIDE{"Admin decision"}
    DECIDE -->|Approve| HASSCHED{"Schedule and effective-from date selected?"}
    HASSCHED -->|No| NEEDSCHED["Approve button disabled until a schedule is chosen"]
    NEEDSCHED --> HASSCHED
    HASSCHED -->|Yes| APPROVE["approve_employee RPC in one transaction: status active, approved_by, approved_at, insert employee_schedules row"]
    DECIDE -->|Reject| HASREASON{"Rejection reason entered?"}
    HASREASON -->|No| NEEDREASON["Reject button disabled, reason is required"]
    NEEDREASON --> HASREASON
    HASREASON -->|Yes| REJECT["reject_employee RPC: status rejected, store rejection_reason"]
    APPROVE --> AUDIT["Audit trigger writes audit_logs row with acting admin, old and new data"]
    REJECT --> AUDIT
    AUDIT --> INAPP["Insert in-app notification for the registrant"]
    INAPP --> MAILCFG{"RESEND_API_KEY configured?"}
    MAILCFG -->|Yes| SENDMAIL["send-notification-email sends the approval or rejection email with the reason"]
    MAILCFG -->|No| INAPPONLY["In-app notification only"]
    SENDMAIL --> RESULT{"Outcome"}
    INAPPONLY --> RESULT
    RESULT -->|Approved| ACTIVE(["Employee may now log in to the mobile app and bind a phone"])
    RESULT -->|Rejected| REJECTED(["Sign-in routes to /rejected showing the reason, account deleted 90 days after rejection"])

    classDef failNode fill:#fee2e2,stroke:#991b1b,color:#7f1d1d
    classDef okNode fill:#dcfce7,stroke:#166534,color:#14532d
    classDef dbNode fill:#f4f4f5,stroke:#3f3f46,color:#18181b
    class NOCONSENT,FIELDERR,NEEDSCHED,NEEDREASON,REJECTED failNode
    class ACTIVE okNode
    class PROFILE,ENC,APPROVE,REJECT,AUDIT,INAPP dbNode
```

---

## 2. Device binding on first mobile login

On first launch, the app creates a random installation UUID and saves it in SecureStore. After login, it calls `bind-device`. If the account is not an active employee, the app shows the Blocked screen and allows only logout. Pending, rejected and inactive accounts each get their own message, and rejected accounts see the reason. For an active employee, the server hashes the raw ID with `DEVICE_HASH_PEPPER` and stores only the hash. If the hash matches the employee's active device, the binding is confirmed. If the employee already has a different active phone, or the phone is already bound to another active employee, the request is rejected with `DEVICE_MISMATCH`. If neither is true, a new `devices` row is inserted and audited. A blocked second phone stays blocked until the admin uses "Reset device", which sets `revoked_at`. The next login from any phone then binds that phone. The app checks status and binding again each time it starts or returns to the foreground.

**References:** FR-27, FR-28, FR-29, FR-30, FR-31, FR-32, FR-33, FR-34, FR-140, FR-141, FR-144 · BR: device binding/reset · D-01, D-05, D-06, D-07

```mermaid
flowchart TD
    START(["Employee opens the mobile app"])
    START --> HASUUID{"Installation UUID in SecureStore?"}
    HASUUID -->|No| GENUUID["Generate random UUID v4 and save it in SecureStore"]
    HASUUID -->|Yes| LOGIN["Log in with email and password through Supabase Auth"]
    GENUUID --> LOGIN
    LOGIN --> CREDOK{"Credentials valid and email verified?"}
    CREDOK -->|No| CREDERR["Show sign-in error"]
    CREDERR --> LOGIN
    CREDOK -->|Yes| CALLBIND["Call bind-device over TLS with raw UUID, platform and model"]
    CALLBIND --> STATUS{"Role employee and status active?"}
    STATUS -->|pending| BLKPENDING["Blocked screen: waiting for admin approval"]
    STATUS -->|rejected| BLKREJECTED["Blocked screen: registration rejected, reason shown"]
    STATUS -->|inactive| BLKINACTIVE["Blocked screen: account deactivated, contact the admin"]
    STATUS -->|"admin, kiosk or viewer"| BLKROLE["Blocked screen: the mobile app is for BHW employees only"]
    BLKPENDING --> LOGOUTONLY(["ACCOUNT_NOT_ACTIVE: only logout is allowed"])
    BLKREJECTED --> LOGOUTONLY
    BLKINACTIVE --> LOGOUTONLY
    BLKROLE --> LOGOUTONLY
    STATUS -->|Yes| HASH["Server computes device_id_hash = HMAC-SHA256 of the raw UUID with DEVICE_HASH_PEPPER, raw UUID discarded"]
    HASH --> HASACTIVE{"Employee already has an active device with revoked_at null?"}
    HASACTIVE -->|Yes| SAMEHASH{"Hash equals the active device hash?"}
    SAMEHASH -->|Yes| BOUNDOK["Binding confirmed"]
    SAMEHASH -->|No| SECONDPHONE["DEVICE_MISMATCH: this account is bound to another phone, ask the admin for a device reset"]
    HASACTIVE -->|No| OTHEREMP{"Hash active for a different employee?"}
    OTHEREMP -->|Yes| TAKEN["DEVICE_MISMATCH: this phone is already bound to another account"]
    OTHEREMP -->|No| INSERTDEV["Insert devices row: device_id_hash, platform, model, bound_at = now()"]
    INSERTDEV --> AUDITDEV["Audit trigger logs the binding"]
    AUDITDEV --> BOUNDOK
    BOUNDOK --> HOME(["Home screen, status and binding re-checked on every start and return to foreground"])
    SECONDPHONE --> WAITRESET["Second phone stays blocked, Scan and My QR are disabled"]
    TAKEN --> WAITRESET
    WAITRESET --> RESETQ{"Admin clicks Reset device on the employee detail page?"}
    RESETQ -->|No| WAITRESET
    RESETQ -->|Yes| RESET["reset_device RPC: set revoked_at = now(), audit with reason, notify the employee"]
    RESET --> NEXTLOGIN["Employee logs in again from any phone"]
    NEXTLOGIN --> CALLBIND

    classDef failNode fill:#fee2e2,stroke:#991b1b,color:#7f1d1d
    classDef okNode fill:#dcfce7,stroke:#166534,color:#14532d
    classDef dbNode fill:#f4f4f5,stroke:#3f3f46,color:#18181b
    class CREDERR,BLKPENDING,BLKREJECTED,BLKINACTIVE,BLKROLE,LOGOUTONLY,SECONDPHONE,TAKEN failNode
    class HOME okNode
    class INSERTDEV,AUDITDEV,RESET dbNode
```

---

## 3. Scan to attend

The flow begins on the phone. An optional phone fingerprint or Face ID unlock comes first, followed by the pre-scan health check. Its codes (`BIOMETRIC_FAILED`, `CAMERA_DENIED`, `LOCATION_DENIED`, `LOCATION_UNAVAILABLE`, `OFFLINE`) never reach the server, and scans are never queued offline. The app then reads the kiosk QR, accepts only `BHWQR1:` content, adds a selfie when `selfie_required` is on, and calls `record-attendance`. The Edge Function runs the 15 checks of decisions Section D in the fixed order and stops at the first failure. Step 5 has two outcomes: `DEVICE_NOT_BOUND` when no device is bound, and `DEVICE_MISMATCH` when a different phone is bound. Between step 13 and step 14, the function finds the work date with the overnight rule. A scan before 04:00 Manila closes the previous day's open record. Step 14 needs this work date to know whether the day is already closed. When all checks pass, the time-in or time-out decision runs. Time-in computes `minutes_late` from the start time once the grace period is exceeded. Time-out computes `undertime_minutes` and applies the status precedence late > undertime > on_time. Non-work days, holidays and employees without a schedule are stored as `on_time` with a note. The attendance row, the `qr_nonce_uses` row and a successful `scan_attempts` row are written in one transaction. If a parallel request hits the `qr_nonce_uses` primary key, the transaction rolls back and returns `QR_REUSED`. Realtime then updates the dashboard within 2 seconds. Every failed attempt is also written to `scan_attempts`, with `employee_id` empty when the JWT is invalid. Any unexpected exception returns `INTERNAL_ERROR` and is written to `error_logs`. The app shows an animated success or failure overlay with haptic feedback and a plain-language English or Filipino message.

**References:** FR-44, FR-45, FR-46, FR-47, FR-48, FR-49, FR-50, FR-51, FR-52, FR-53, FR-54, FR-55, FR-56, FR-57, FR-58, FR-59, FR-61, FR-97, FR-114, FR-121 · BR: time-in vs time-out decision, status computation with grace period, undertime computation, cooldown, scans after midnight, holidays, schedule changes · D-08, D-09, D-10, D-11, Section D (steps 1–15 and `INTERNAL_ERROR`), D-13, D-14, D-15, D-16, D-17, D-18, D-19, D-20

```mermaid
flowchart TD
    START(["Employee taps the Scan button"])
    BIO{"Biometric unlock turned on in Profile?"}
    BIO2{"Phone fingerprint or Face ID accepted?"}
    MBIO["BIOMETRIC_FAILED: try again, nothing is sent to the server"]
    FIXRETRY(["Employee fixes the problem and taps Scan again"])
    START --> BIO
    BIO -->|Yes| BIO2
    BIO2 -->|No| MBIO

    subgraph PRE["Mobile pre-scan health check - these codes stay on the phone"]
        HC{"Camera permission granted?"}
        HC -->|No| MCAM["CAMERA_DENIED: show how to allow the camera"]
        HC -->|Yes| HL{"Location permission granted?"}
        HL -->|No| MLOC["LOCATION_DENIED: show how to allow location"]
        HL -->|Yes| HG{"GPS fix available?"}
        HG -->|No| MGPS["LOCATION_UNAVAILABLE: turn on GPS and move near a window"]
        HG -->|Yes| HN{"Internet connection available?"}
        HN -->|No| MOFF["OFFLINE: Snackbar notice, the scan is never queued"]
        HN -->|Yes| HD{"Account active and device still bound?"}
        HD -->|No| MBND["Open the Blocked or Bind Device screen"]
    end

    subgraph CAM["Mobile scan and request"]
        SC["Camera reads the kiosk QR"]
        SC --> PX{"Content starts with BHWQR1: ?"}
        PX -->|No| MPX["Not an office kiosk QR, no server call"]
        PX -->|Yes| SF{"selfie_required is on?"}
        SF -->|Yes| SFC["Capture front-camera selfie"]
        SF -->|No| CALL["POST record-attendance with token, raw device ID, lat, lng, accuracy and selfie if taken"]
        SFC --> CALL
    end

    subgraph VAL["record-attendance - fixed order, stops at the first failure"]
        V1{"Step 1: Valid JWT?"}
        V1 -->|No| E1["AUTH_REQUIRED, HTTP 401"]
        V1 -->|Yes| V2{"Step 2: At most 10 requests per minute for this user?"}
        V2 -->|No| E2["RATE_LIMITED, HTTP 429"]
        V2 -->|Yes| V3{"Step 3: Request body valid against the zod schema?"}
        V3 -->|No| E3["INVALID_REQUEST, HTTP 400"]
        V3 -->|Yes| V4{"Step 4: Role employee and status active?"}
        V4 -->|No| E4["ACCOUNT_NOT_ACTIVE, HTTP 403"]
        V4 -->|Yes| V5A{"Step 5a: Employee has an active bound device?"}
        V5A -->|No| E5A["DEVICE_NOT_BOUND, HTTP 403"]
        V5A -->|Yes| V5B{"Step 5b: HMAC hash of the sent device ID equals the active device hash?"}
        V5B -->|No| E5B["DEVICE_MISMATCH, HTTP 403"]
        V5B -->|Yes| V6{"Step 6: Token format and HMAC signature valid with the current or previous secret?"}
        V6 -->|No| E6["QR_INVALID, HTTP 400"]
        V6 -->|Yes| V7{"Step 7: Server now at or before exp, and iat at most now plus 5 s?"}
        V7 -->|No| E7["QR_EXPIRED, HTTP 400"]
        V7 -->|Yes| V8{"Step 8: Nonce exists in qr_nonces for this station?"}
        V8 -->|No| E8["QR_UNKNOWN, HTTP 400"]
        V8 -->|Yes| V9{"Step 9: Nonce not yet used by this employee in qr_nonce_uses?"}
        V9 -->|No| E9["QR_REUSED, HTTP 409"]
        V9 -->|Yes| V10{"Step 10: Station exists and is_active?"}
        V10 -->|No| E10["STATION_INACTIVE, HTTP 400"]
        V10 -->|Yes| V11{"Step 11: GPS accuracy at most max_gps_accuracy_m, default 50 m?"}
        V11 -->|No| E11["GPS_INACCURATE, HTTP 400"]
        V11 -->|Yes| V12{"Step 12: Haversine distance at most the station radius_m, default 100 m?"}
        V12 -->|No| E12["OUTSIDE_GEOFENCE, HTTP 403: move closer to the office"]
        V12 -->|Yes| V13{"Step 13: No successful scan in the last cooldown_minutes, default 5?"}
        V13 -->|No| E13["COOLDOWN_ACTIVE, HTTP 429: shows when scanning is allowed again"]
        V13 -->|Yes| WD["Resolve work date with the overnight rule: Manila time before overnight_cutoff_hour 04:00 AND previous day has time_in without time_out gives the previous day, otherwise today"]
        WD --> V14{"Step 14: Work-date record not already closed with both time_in and time_out?"}
        V14 -->|No| E14["ALREADY_COMPLETED, HTTP 409"]
        V14 -->|Yes| V15{"Step 15: Selfie present when selfie_required = true?"}
        V15 -->|No| E15["SELFIE_REQUIRED, HTTP 400"]
    end

    subgraph DEC["Time-in or time-out decision and status - server time, Asia/Manila"]
        DTYPE{"Record for the work date?"}
        DTYPE -->|"None, or absent row from the end-of-day job"| TIN["Action: TIME-IN"]
        DTYPE -->|"Has time_in, no time_out"| TOUT["Action: TIME-OUT"]
        TIN --> SA{"Schedule in effect on the work date?"}
        SA -->|No| NS["minutes_late 0, status on_time, notes: No schedule assigned"]
        SA -->|Yes| SB{"Holiday, or weekday not in schedule work_days?"}
        SB -->|Yes| NW["minutes_late 0, status on_time, notes: holiday name or Non-working day"]
        SB -->|No| SG{"time_in at or before start_time plus grace_minutes?"}
        SG -->|Yes| ONT["minutes_late 0, provisional status on_time"]
        SG -->|No| LAT["minutes_late = time_in minus start_time, provisional status late"]
        TOUT --> SD{"Record noted as holiday, non-working day or no schedule?"}
        SD -->|Yes| ZU["undertime_minutes 0, status stays on_time"]
        SD -->|No| CU["undertime_minutes = max(0, end_time minus time_out)"]
        CU --> PL{"minutes_late above 0?"}
        PL -->|Yes| SL["status late, both numbers kept"]
        PL -->|No| PU{"undertime_minutes above 0?"}
        PU -->|Yes| SUN["status undertime"]
        PU -->|No| SON["status on_time"]
    end

    subgraph DBW["One database transaction"]
        W1["Insert or update attendance_records: method qr, station_id, time_in or time_out, minutes_late, undertime_minutes, status, time_in_scan_id or time_out_scan_id"]
        W1 --> W2["Insert qr_nonce_uses row for this nonce and employee"]
        W2 --> W3["Insert scan_attempts row: success true, selfie_path if taken"]
        W3 --> W4["Audit trigger writes audit_logs"]
    end

    subgraph FAILP["Failure path"]
        LF["Insert scan_attempts row: success false, error_code, failure_reason, lat, lng, accuracy, device_id_hash, nonce, server time"]
        LF --> AF["Anomaly rules may flag the employee for admin review: 5 or more failures in 10 minutes, repeated OUTSIDE_GEOFENCE or QR_REUSED"]
        AF --> RF["Return error code, HTTP status and friendly English or Filipino message"]
        RF --> FOV(["App shows the animated failure overlay with fix guidance and error haptic"])
    end

    EXC["Unexpected exception in any step or in the transaction"]
    E99["INTERNAL_ERROR, HTTP 500"]
    ELOG["error_logs row: source edge_function, severity error, secrets removed from context"]
    RT["Realtime pushes the change: admin dashboard within 2 s, kiosk feed shows first name and time"]
    RS["Return HTTP 200 with action, Manila time, status and friendly message"]
    SUCC(["App shows the animated success overlay with success haptic"])

    BIO -->|No| HC
    BIO2 -->|Yes| HC
    HD -->|Yes| SC
    CALL --> V1
    V15 -->|Yes| DTYPE
    NS --> W1
    NW --> W1
    ONT --> W1
    LAT --> W1
    ZU --> W1
    SL --> W1
    SUN --> W1
    SON --> W1
    W2 -.->|"Primary key conflict from a parallel request, rollback"| E9
    W4 --> RT
    RT --> RS
    RS --> SUCC
    E1 --> LF
    E2 --> LF
    E3 --> LF
    E4 --> LF
    E5A --> LF
    E5B --> LF
    E6 --> LF
    E7 --> LF
    E8 --> LF
    E9 --> LF
    E10 --> LF
    E11 --> LF
    E12 --> LF
    E13 --> LF
    E14 --> LF
    E15 --> LF
    VAL -.->|"throws"| EXC
    DBW -.->|"throws, rollback"| EXC
    EXC --> E99
    E99 --> ELOG
    ELOG --> LF
    MBIO --> FIXRETRY
    MCAM --> FIXRETRY
    MLOC --> FIXRETRY
    MGPS --> FIXRETRY
    MOFF --> FIXRETRY
    MPX --> FIXRETRY

    classDef failNode fill:#fee2e2,stroke:#991b1b,color:#7f1d1d
    classDef okNode fill:#dcfce7,stroke:#166534,color:#14532d
    classDef dbNode fill:#f4f4f5,stroke:#3f3f46,color:#18181b
    class MBIO,MCAM,MLOC,MGPS,MOFF,MBND,MPX,E1,E2,E3,E4,E5A,E5B,E6,E7,E8,E9,E10,E11,E12,E13,E14,E15,E99,FOV failNode
    class SUCC okNode
    class W1,W2,W3,W4,LF,ELOG dbNode
```

**Validation step to error code summary** (same order as decisions Section D):

| Step | Check | Error code | HTTP | FR |
| --- | --- | --- | --- | --- |
| 1 | Valid JWT | `AUTH_REQUIRED` | 401 | FR-47, FR-141 |
| 2 | Rate limit, 10 requests per minute per user | `RATE_LIMITED` | 429 | FR-47 |
| 3 | Request body valid (zod) | `INVALID_REQUEST` | 400 | FR-47 |
| 4 | Role employee and status active | `ACCOUNT_NOT_ACTIVE` | 403 | FR-47, FR-28 |
| 5 | Device bound / hash matches | `DEVICE_NOT_BOUND` / `DEVICE_MISMATCH` | 403 | FR-30, FR-47 |
| 6 | Token format and HMAC signature | `QR_INVALID` | 400 | FR-37, FR-42 |
| 7 | Not expired, `iat` not more than 5 s ahead | `QR_EXPIRED` | 400 | FR-48 |
| 8 | Nonce known for the station | `QR_UNKNOWN` | 400 | FR-49 |
| 9 | Nonce not reused by this employee | `QR_REUSED` | 409 | FR-49 |
| 10 | Station exists and active | `STATION_INACTIVE` | 400 | FR-47 |
| 11 | GPS accuracy within limit | `GPS_INACCURATE` | 400 | FR-50 |
| 12 | Inside geofence | `OUTSIDE_GEOFENCE` | 403 | FR-50 |
| 13 | Cooldown passed | `COOLDOWN_ACTIVE` | 429 | FR-51 |
| 14 | Day not already completed | `ALREADY_COMPLETED` | 409 | FR-52 |
| 15 | Selfie present when required | `SELFIE_REQUIRED` | 400 | FR-57 |
| — | Unexpected error | `INTERNAL_ERROR` | 500 | FR-121 |

---

## 4. Fallback: personal QR and manual entry

When a kiosk scan cannot be completed (for example a broken phone camera, a GPS failure or an offline kiosk), the admin has two audited alternatives. **(A) Personal QR:** the employee opens My QR, and `issue-personal-qr` refuses the QR unless the employee is active and on the bound device. The admin scans the `BHWPQR1:` code on the Fallback Scan page. `record-fallback-scan` checks, in order: an active admin caller, a valid request, the signature with `PERSONAL_QR_SIGNING_SECRET`, expiry, nonce reuse, employee status, station, cooldown and day completion. Each failure uses the same error codes as the kiosk scan. Geofence and GPS checks are skipped because the admin is physically present. The record uses the same time-in/time-out, overnight and status rules as flowchart 3, with method `fallback_personal_qr`, the station chosen by the admin, and the admin as `created_by`. **(B) Manual entry:** the admin enters the employee, work date and times with a reason of at least 10 characters. Future dates or times and a time-out before the time-in are rejected. `manual_attendance_entry` recomputes late, undertime and status from the schedule in effect on that date and stores method `manual`. Both paths are audited with their reason or note and appear with a method badge on records, history and the DTR.

**References:** FR-62, FR-63, FR-64, FR-65, FR-66, FR-67, FR-121, FR-129 · BR: fallback and manual entry, time-in vs time-out decision, status computation with grace period, undertime computation, cooldown, scans after midnight · D-12, D-13, D-14, D-15, D-16, D-17, D-18, D-19, D-20, D-28

```mermaid
flowchart TD
    START(["Employee cannot complete a kiosk scan: broken camera, GPS failure or kiosk offline"])
    START --> CHOICE{"Which fallback does the admin use?"}

    subgraph PQ["A. Personal QR scanned by the admin - method fallback_personal_qr"]
        P1["Employee opens the My QR tab"]
        P1 --> P2{"issue-personal-qr: active employee on the bound device?"}
        P2 -->|No| P2F["No QR shown: ACCOUNT_NOT_ACTIVE, DEVICE_NOT_BOUND or DEVICE_MISMATCH"]
        P2 -->|Yes| P3["App shows the BHWPQR1: QR, valid 30 s, refreshed every 15 s"]
        P3 --> P4["Admin opens Fallback Scan, picks the station, adds an optional note and scans the phone screen"]
        P4 --> P5{"Content starts with BHWPQR1: ?"}
        P5 -->|No| P5F["Not a personal QR, no server call"]
        P5 -->|Yes| F1{"Caller signed in as an active admin?"}
        F1 -->|No| F1F["AUTH_REQUIRED, HTTP 401, or HTTP 403 for a non-admin role"]
        F1 -->|Yes| F2{"Request body valid?"}
        F2 -->|No| F2F["INVALID_REQUEST, HTTP 400"]
        F2 -->|Yes| F3{"Format and HMAC signature valid with PERSONAL_QR_SIGNING_SECRET?"}
        F3 -->|No| F3F["QR_INVALID, HTTP 400"]
        F3 -->|Yes| F4{"Server now at or before exp, and iat at most now plus 5 s?"}
        F4 -->|No| F4F["QR_EXPIRED, HTTP 400"]
        F4 -->|Yes| F5{"Nonce not already used for this employee?"}
        F5 -->|No| F5F["QR_REUSED, HTTP 409"]
        F5 -->|Yes| F6{"QR owner has role employee and status active?"}
        F6 -->|No| F6F["ACCOUNT_NOT_ACTIVE, HTTP 403"]
        F6 -->|Yes| F7{"Chosen station exists and is active?"}
        F7 -->|No| F7F["STATION_INACTIVE, HTTP 400"]
        F7 -->|Yes| F7C{"No successful scan by this employee in the last cooldown_minutes?"}
        F7C -->|No| F7CF["COOLDOWN_ACTIVE, HTTP 429"]
        F7C -->|Yes| F8{"Work-date record, after the overnight rule, not already closed?"}
        F8 -->|No| F8F["ALREADY_COMPLETED, HTTP 409"]
        F8 -->|Yes| F9["Same time-in or time-out decision and status rules as flowchart 3"]
        F9 --> F10["Write attendance_records: method fallback_personal_qr, chosen station, created_by admin, notes, plus qr_nonce_uses row"]
    end

    subgraph MAN["B. Manual entry by the admin - method manual"]
        M1["Admin opens Manual entry: employee, work date, time-in and/or time-out, reason"]
        M1 --> M2{"Reason has at least 10 characters?"}
        M2 -->|No| M2F["Form error: a reason of at least 10 characters is required"]
        M2 -->|Yes| M3{"Date and times not in the future in Manila time, and time-out after time-in?"}
        M3 -->|No| M3F["Rejected: future or invalid times"]
        M3 -->|Yes| M4["manual_attendance_entry RPC with is_admin check"]
        M4 --> M5["Recompute minutes_late, undertime_minutes and status from the schedule in effect on that work date"]
        M5 --> M6["Insert or update attendance_records: method manual, created_by admin, notes = reason"]
    end

    PQFAIL["Fallback Scan page shows the message, admin asks for a fresh QR or switches to manual entry"]
    PQERR["Unexpected error: INTERNAL_ERROR, HTTP 500, written to error_logs"]
    AUD["Audit trigger writes audit_logs including the reason or note"]
    RTU["Realtime updates the dashboard, method badge shown in records, history and DTR source"]
    DONE(["Admin sees a success toast, employee sees the record in History"])

    CHOICE -->|"Personal QR"| P1
    CHOICE -->|"Manual entry"| M1
    F1F --> PQFAIL
    F2F --> PQFAIL
    F3F --> PQFAIL
    F4F --> PQFAIL
    F5F --> PQFAIL
    F6F --> PQFAIL
    F7F --> PQFAIL
    F7CF --> PQFAIL
    F8F --> PQFAIL
    P5F --> PQFAIL
    PQ -.->|"throws"| PQERR
    MAN -.->|"throws"| PQERR
    PQERR --> PQFAIL
    PQFAIL -.->|"switch to manual entry"| M1
    M2F --> M1
    M3F --> M1
    F10 --> AUD
    M6 --> AUD
    AUD --> RTU
    RTU --> DONE

    classDef failNode fill:#fee2e2,stroke:#991b1b,color:#7f1d1d
    classDef okNode fill:#dcfce7,stroke:#166534,color:#14532d
    classDef dbNode fill:#f4f4f5,stroke:#3f3f46,color:#18181b
    class P2F,P5F,F1F,F2F,F3F,F4F,F5F,F6F,F7F,F7CF,F8F,M2F,M3F,PQFAIL,PQERR failNode
    class DONE okNode
    class F10,M6,AUD dbNode
```

---

## 5. Correction request approval

An employee files a correction request from the mobile History screen, the Correction Request form or the web `/me` page. Eligibility is checked first:

- The work date is not in the future.
- The work date is in the current Manila month, or in the previous month while today is within the first `correction_window_days` (default 5) days of the month.
- No other pending request exists for the same work date.
- An attachment, if added, is an image or PDF of at most 5 MB.

A valid request is saved as `pending`, audited, and admins are notified. While it is pending, the employee may cancel it (`cancelled`). The admin reviews the current record beside the requested values. **Reject** requires remarks and leaves the attendance record unchanged. **Approve** runs `review_correction_request` as one transaction:

- It confirms the request is still pending.
- It upserts the attendance record with method `correction`. An `official_business` request with both times blank uses the schedule start and end times and the note "Official business".
- It recomputes late, undertime and status, marks the request approved, inserts the notification and lets the audit triggers log both changes.

If any part fails, everything rolls back. Because the DTR is built live from the records, it shows the change immediately. Outcome emails are sent when Resend is configured.

**References:** FR-68, FR-69, FR-70, FR-71, FR-72, FR-73, FR-74, FR-75, FR-76, FR-77, FR-85, FR-121, FR-142, FR-143, FR-144 · BR: correction request eligibility and approval, status computation with grace period, undertime computation · D-25, D-26, D-27, D-28, D-31, D-33

```mermaid
flowchart TD
    START(["Employee taps Request correction in mobile History or on web /me"])
    START --> FILL["Choose type: missing_time_in, missing_time_out, wrong_time or official_business. Enter work date, requested time-in and/or time-out, reason, optional attachment"]
    FILL --> REQF{"Required fields for the chosen type present?"}
    REQF -->|No| REQFERR["Form error shown under the field"]
    REQFERR --> FILL
    REQF -->|Yes| FUT{"Work date in the future?"}
    FUT -->|Yes| FUTERR["Not allowed: future dates cannot be corrected"]
    FUT -->|No| CURM{"Work date in the current Manila month?"}
    CURM -->|Yes| DUP
    CURM -->|No| PREVM{"Work date in the previous month AND today is day 1 to correction_window_days, default 5?"}
    PREVM -->|No| WINERR["Not allowed: outside the correction window"]
    PREVM -->|Yes| DUP{"Another pending request for this work date?"}
    DUP -->|Yes| DUPERR["Not allowed: one pending request per work date"]
    DUP -->|No| ATT{"Attachment added?"}
    ATT -->|Yes| ATTOK{"Image or PDF of at most 5 MB?"}
    ATTOK -->|No| ATTERR["Form error: file type or size"]
    ATTERR --> FILL
    ATTOK -->|Yes| UPLOAD["Upload to private correction-attachments bucket"]
    UPLOAD --> SAVE
    ATT -->|No| SAVE["Insert correction_requests row with status pending"]
    SAVE --> NOTIFYADM["Audit trigger logs the request, admins get an in-app notification"]
    NOTIFYADM --> CANCELQ{"Employee cancels while still pending?"}
    CANCELQ -->|Yes| CANCELLED(["Status cancelled, audited, no further action"])
    CANCELQ -->|No| REVIEW["Admin opens Correction Requests: current record beside requested values, attachment through signed URL"]
    REVIEW --> DECISION{"Admin decision"}
    DECISION -->|Reject| REMARKS{"Remarks entered?"}
    REMARKS -->|No| NEEDREM["Reject button disabled: remarks are required"]
    NEEDREM --> REMARKS
    REMARKS -->|Yes| DOREJECT["review_correction_request: status rejected, reviewed_by, reviewed_at, remarks, attendance record unchanged"]
    DOREJECT --> REJNOTE["Insert notification with remarks, audit trigger logs the change"]

    subgraph TXN["review_correction_request approve - one transaction"]
        T1{"Request still pending?"}
        T1 -->|No| T1F["Abort: already reviewed or cancelled"]
        T1 -->|Yes| T2{"official_business with both times blank?"}
        T2 -->|Yes| T3["Use the schedule start_time and end_time, notes Official business"]
        T2 -->|No| T4["Use the requested time-in and/or time-out"]
        T3 --> T5["Insert or update attendance_records for the work date with method correction"]
        T4 --> T5
        T5 --> T6["Recompute minutes_late, undertime_minutes and status by the same precedence rules"]
        T6 --> T7["Set request approved, reviewed_by, reviewed_at, optional remarks"]
        T7 --> T8["Insert in-app notification for the employee"]
        T8 --> T9["Audit triggers log the attendance change and the request change"]
    end

    COMMIT{"Transaction committed?"}
    ROLLBACK["Rollback everything, INTERNAL_ERROR written to error_logs, admin sees an error toast"]
    LIVE["Record, reports and DTR show the change at once because the DTR is built live"]
    MAILCFG{"RESEND_API_KEY configured?"}
    SENDMAIL["send-notification-email sends the outcome with remarks"]
    INAPPONLY["In-app notification only"]
    FINISH(["Employee sees the outcome and remarks in My Requests"])

    DECISION -->|Approve| T1
    T9 --> COMMIT
    COMMIT -->|No| ROLLBACK
    COMMIT -->|Yes| LIVE
    LIVE --> MAILCFG
    REJNOTE --> MAILCFG
    MAILCFG -->|Yes| SENDMAIL
    MAILCFG -->|No| INAPPONLY
    SENDMAIL --> FINISH
    INAPPONLY --> FINISH

    classDef failNode fill:#fee2e2,stroke:#991b1b,color:#7f1d1d
    classDef okNode fill:#dcfce7,stroke:#166534,color:#14532d
    classDef dbNode fill:#f4f4f5,stroke:#3f3f46,color:#18181b
    class REQFERR,FUTERR,WINERR,DUPERR,ATTERR,NEEDREM,T1F,ROLLBACK failNode
    class FINISH okNode
    class SAVE,NOTIFYADM,DOREJECT,REJNOTE,T5,T7,T8,T9 dbNode
```

---

## 6. DTR generation (single and batch, PDF)

The DTR (Civil Service Form No. 48) is always built live from `attendance_records`, the schedule in effect on each day, the `holidays` table and `app_settings`. No copy is stored, so corrections, manual entries and fallback scans show up immediately. An employee can generate only their own DTR. An admin can choose one employee or batch mode for all active employees. Viewers and kiosks are denied. For each calendar day from 1 to 31:

- Days that do not exist in the month are left blank.
- Weekends, non-work days and holidays without a scan show their label.
- Absent days show "Absent" with the full scheduled minutes as undertime.
- Otherwise time-in goes to AM or PM Arrival by comparing it with `break_start`, and time-out goes to AM or PM Departure by comparing it with `break_end`. Days without a time-out show "No time-out".
- Lunch cells are filled only when `dtr_fill_break_times` is on and the day spans the break (time-in before `break_start` and time-out after `break_end`, BR-74).
- The undertime column is `minutes_late + undertime_minutes`.

Monthly totals are the sum of the daily values. The header and footer carry the CSC certification and the two signature lines. The result can be shown on screen, printed (A4 or legal) or downloaded as a PDF from `generate-dtr-pdf`. Batch mode produces one PDF with one employee per page.

**References:** FR-78, FR-79, FR-80, FR-81, FR-82, FR-83, FR-84, FR-85, FR-134 · BR: DTR AM/PM split and totals, holidays, schedule changes · D-19, D-22, D-23, D-24

```mermaid
flowchart TD
    START(["Open the DTR page on the admin web, or My DTR on mobile or /me"])
    START --> WHO{"Signed-in role?"}
    WHO -->|"viewer or kiosk"| DENY["Access denied by RLS and route middleware"]
    WHO -->|employee| EMP["Employee is fixed to self, picks year and month"]
    WHO -->|admin| MODE{"Single employee or batch?"}
    MODE -->|Single| ADM1["Admin picks employee, year and month"]
    MODE -->|Batch| BT1["Admin picks year and month and clicks Batch generate"]
    EMP --> G1["get_dtr(employee_id, year, month)"]
    ADM1 --> G1
    BT1 --> GB["get_dtr_batch(year, month): list all active employees"]
    GB --> NEXTE["Take the next employee"]
    NEXTE --> G1
    G1 --> LOAD["Load attendance_records, schedule in effect per day, holidays and app_settings, live with no stored copy"]

    subgraph ROWS["Build one row for each calendar day 1 to 31"]
        R1{"Day exists in this month?"}
        R1 -->|No| RB["Row left blank"]
        R1 -->|Yes| R2{"Attendance record for the day?"}
        R2 -->|No| R3{"Weekend, non-work day or holiday?"}
        R3 -->|Yes| RL["Show the day label: Saturday, Sunday or holiday name"]
        R3 -->|No| RE["Leave blank: today, a future day or before the schedule started"]
        R2 -->|Yes| R4{"Status absent?"}
        R4 -->|Yes| RA["Show Absent, undertime = end minus start minus break minutes"]
        R4 -->|No| R5{"time_in before break_start?"}
        R5 -->|Yes| AMA["AM Arrival = time_in"]
        R5 -->|No| PMA["PM Arrival = time_in"]
        AMA --> R6{"time_out recorded?"}
        PMA --> R6
        R6 -->|No| RNT["Show No time-out, undertime = minutes_late plus undertime_minutes as recorded"]
        R6 -->|Yes| R7{"time_out after break_end?"}
        R7 -->|Yes| PMD["PM Departure = time_out"]
        R7 -->|No| AMD["AM Departure = time_out"]
        PMD --> R8{"dtr_fill_break_times on AND time_in before break_start AND time_out after break_end?"}
        AMD --> R8
        R8 -->|Yes| BF["Fill unscanned lunch cells with break_start and break_end"]
        R8 -->|No| BB["Leave unscanned lunch cells blank"]
        BF --> UTD["Undertime = minutes_late plus undertime_minutes, shown as hours and minutes"]
        BB --> UTD
        RB --> RN{"More days?"}
        RL --> RN
        RE --> RN
        RA --> RN
        RNT --> RN
        UTD --> RN
        RN -->|Yes| R1
    end

    TOT["Monthly totals = sum of the daily undertime hours and minutes"]
    HDR["Header and footer: name, month and year, office_name, Regular days and Saturdays hours from the schedule, CSC certification text, employee signature line, Verified as to the prescribed office hours, in-charge signature line"]
    BQ{"Batch run?"}
    BPG["Add as one page, one employee per page"]
    BM{"More employees?"}
    BPDF(["generate-dtr-pdf returns one combined PDF for printing"])
    FMT{"Output choice"}
    SCR(["Show on screen, monthly view on mobile"])
    PRN(["Print layout, A4 or legal"])
    PDF1(["generate-dtr-pdf returns the PDF file"])

    LOAD --> R1
    RN -->|No| TOT
    TOT --> HDR
    HDR --> BQ
    BQ -->|Yes| BPG
    BPG --> BM
    BM -->|Yes| NEXTE
    BM -->|No| BPDF
    BQ -->|No| FMT
    FMT -->|Screen| SCR
    FMT -->|Print| PRN
    FMT -->|PDF| PDF1

    classDef failNode fill:#fee2e2,stroke:#991b1b,color:#7f1d1d
    classDef okNode fill:#dcfce7,stroke:#166534,color:#14532d
    classDef dbNode fill:#f4f4f5,stroke:#3f3f46,color:#18181b
    class DENY failNode
    class BPDF,SCR,PRN,PDF1 okNode
    class LOAD dbNode
```

---

## 7. Kiosk health monitoring

Every 60 seconds (`heartbeat_interval_seconds`), the kiosk page sends a heartbeat with its app version, last token time and its own clock reading. `kiosk-heartbeat` accepts heartbeats only from the kiosk account linked to that station. It computes clock drift as kiosk time minus server time, stores a `kiosk_heartbeats` row and updates `stations.last_seen_at`. If the station was offline, it sets the station back online, and Realtime clears the alert on the dashboard. A drift of more than 30 seconds raises a warning on the Device Health page and among the dashboard device alerts. A pg_cron job runs every minute and checks each active station. When `last_seen_at` is older than 3 heartbeat intervals (3 minutes), the job sets `is_online = false` once and writes one critical `error_logs` row (source `kiosk`). Realtime pushes the change, so the admin sees the offline alert within 3 minutes. If the kiosk loses its connection, it shows an offline banner and hides the QR after the last token expires. When the connection returns, it immediately requests a new token and sends a heartbeat.

**References:** FR-41, FR-100, FR-109, FR-110, FR-111, FR-112, FR-118, FR-119, FR-148 · BR: none beyond the decisions below (operational rule) · D-03, D-32 (heartbeats kept 30 days), D-34

```mermaid
flowchart TD
    subgraph KIOSK["Kiosk page /kiosk/stationId"]
        K1(["Heartbeat timer fires every heartbeat_interval_seconds, default 60 s"])
        K1 --> K2{"Server reachable?"}
        K2 -->|No| K3["Show offline banner, hide QR once the last token expires, keep retrying"]
        K2 -->|Yes| K4["POST kiosk-heartbeat with app_version, last_token_at and kiosk clock reading"]
        K3 --> K5{"Connection back?"}
        K5 -->|No| K3
        K5 -->|Yes| K6["Request a new QR token and send a heartbeat immediately"]
    end

    subgraph HB["kiosk-heartbeat Edge Function"]
        H1{"Caller is the kiosk account linked to this station?"}
        H1 -->|No| H1F["Rejected with HTTP 401 or 403, nothing stored"]
        H1 -->|Yes| H2["clock_drift_ms = kiosk time minus server time"]
        H2 --> H3["Insert kiosk_heartbeats row"]
        H3 --> H4["Update stations.last_seen_at = now()"]
        H4 --> H5{"Station was marked offline?"}
        H5 -->|Yes| H6["Set is_online = true, Realtime pushes recovery and the dashboard alert clears"]
        H5 -->|No| H7["is_online stays true"]
        H6 --> H8{"Absolute drift above 30 s?"}
        H7 --> H8
        H8 -->|Yes| H9["Drift warning on Device Health and in dashboard device alerts"]
        H8 -->|No| H10(["Station healthy"])
    end

    subgraph CRON["pg_cron offline detection - every minute"]
        C1(["Job runs"])
        C1 --> C2["Check every active station"]
        C2 --> C3{"last_seen_at older than now minus 3 x heartbeat interval, 3 missed heartbeats?"}
        C3 -->|No| C4["No change"]
        C3 -->|Yes| C5{"is_online currently true?"}
        C5 -->|No| C6["Already offline, no duplicate alert"]
        C5 -->|Yes| C7["Set is_online = false"]
        C7 --> C8["Insert error_logs row: source kiosk, severity critical, station and last seen time"]
        C8 --> C9["Realtime pushes the station change"]
        C9 --> C10(["Dashboard device alert and Device Health page show OFFLINE within 3 minutes"])
    end

    K4 --> H1
    K6 --> H1

    classDef failNode fill:#fee2e2,stroke:#991b1b,color:#7f1d1d
    classDef okNode fill:#dcfce7,stroke:#166534,color:#14532d
    classDef dbNode fill:#f4f4f5,stroke:#3f3f46,color:#18181b
    class K3,H1F,H9,C10 failNode
    class H10 okNode
    class H3,H4,H6,C7,C8 dbNode
```

---

## 8. End-of-day job

The end-of-day job runs daily at 04:05 Asia/Manila (20:05 UTC) for the **previous** work date. That is just after the 04:00 overnight cutoff, so overnight time-outs are already recorded. The run has three passes inside one transaction:

1. **Absences.** On a holiday, this pass is skipped entirely. Otherwise, each active employee who has a schedule in effect, whose weekday is in `work_days` and who has no record gets an `absent` row with no times and zero late and undertime minutes.
2. **Incomplete records.** Every record with a time-in and no time-out becomes `incomplete`. Its `minutes_late` is kept and its undertime stays 0 until the record is corrected. The employee gets an in-app suggestion to file a `missing_time_out` correction.
3. **Undertime consistency.** For closed records, the job does not recompute the `undertime_minutes` value that was set at time-out. It only makes sure the stored status follows the precedence late > undertime > on_time.

Every insert and update is audited with the system as actor. Because the job skips rows that already exist, it is safe to run again. A failed run rolls back and writes an `error_logs` row with severity `error`.

**References:** FR-53, FR-106, FR-145, FR-146, FR-149, FR-151 · BR: forgotten time-out, holidays, undertime computation, status computation with grace period, scans after midnight, schedule changes · D-13, D-16, D-17, D-18, D-19, D-21

```mermaid
flowchart TD
    START(["pg_cron fires daily at 04:05 Asia/Manila, 20:05 UTC"])
    START --> TD1["target_date = Manila today minus 1 day, after the 04:00 overnight cutoff so overnight time-outs are already in"]
    TD1 --> BEGIN["Begin transaction, start the job run record"]

    subgraph ABS["Pass 1: absences"]
        HOL{"target_date in the holidays table?"}
        HOL -->|Yes| HOLS["Skip the whole pass: no absences on holidays"]
        HOL -->|No| EMPL["Take the next employee with role employee and status active"]
        EMPL --> P1{"Schedule in effect on target_date?"}
        P1 -->|No| P1S["Skip: no schedule, listed in the weekly verification report"]
        P1 -->|Yes| P2{"target_date weekday in the schedule work_days?"}
        P2 -->|No| P2S["Skip: non-work day"]
        P2 -->|Yes| P3{"Attendance record exists for target_date?"}
        P3 -->|Yes| P3S["Skip: record already exists"]
        P3 -->|No| P4["Insert attendance_records: status absent, no times, minutes_late 0, undertime_minutes 0, method qr, station_id and created_by NULL"]
        P1S --> PN{"More active employees?"}
        P2S --> PN
        P3S --> PN
        P4 --> PN
        PN -->|Yes| EMPL
    end

    subgraph INC["Pass 2: incomplete records"]
        Q1{"Any record for target_date with time_in and no time_out?"}
        Q1 -->|Yes| Q2["Set status incomplete, keep minutes_late, undertime stays 0 until corrected"]
        Q2 --> Q3["In-app notification to each employee: file a missing_time_out correction"]
        Q1 -->|No| Q4["Nothing to flag"]
    end

    subgraph UND["Pass 3: undertime consistency for closed records"]
        U1["Select records for target_date with time_in and time_out, undertime_minutes already set at time-out as max(0, end_time minus time_out)"]
        U1 --> U2{"Stored status follows precedence: late if minutes_late above 0, else undertime if undertime_minutes above 0, else on_time?"}
        U2 -->|Yes| U3["No change"]
        U2 -->|No| U4["Correct the status, values unchanged"]
    end

    AUDJ["Audit triggers log every insert and update with system as actor"]
    OKQ{"All passes succeeded?"}
    COMMIT(["Commit, record outcome counts: absent, incomplete, status fixes. Dashboard, reports and DTR show the results"])
    FAILJ["Rollback, insert error_logs row with severity error"]
    RERUN(["Admin sees it in Error Logs, the job is safe to run again because it skips existing rows"])

    BEGIN --> HOL
    HOLS --> Q1
    PN -->|No| Q1
    Q3 --> U1
    Q4 --> U1
    U3 --> AUDJ
    U4 --> AUDJ
    AUDJ --> OKQ
    OKQ -->|Yes| COMMIT
    OKQ -->|No| FAILJ
    FAILJ --> RERUN

    classDef failNode fill:#fee2e2,stroke:#991b1b,color:#7f1d1d
    classDef okNode fill:#dcfce7,stroke:#166534,color:#14532d
    classDef dbNode fill:#f4f4f5,stroke:#3f3f46,color:#18181b
    class FAILJ,RERUN failNode
    class COMMIT okNode
    class P4,Q2,Q3,U4,AUDJ dbNode
```

---

> **Backend Developer note:** Flowchart 3 is the reference for the Deno tests of `record-attendance` in Phase 3. Each of the 16 error codes, including both step 5 codes and `INTERNAL_ERROR`, needs its own test. The tests must also cover the `qr_nonce_uses` primary-key race, which returns `QR_REUSED`. In flowchart 3, the work date is resolved before step 14, so the overnight rule must live in a helper shared by `record-attendance`, `record-fallback-scan` and `manual_attendance_entry`. Flowchart 8 needs one attendance row per employee per work date, enforced by a unique index on `attendance_records(employee_id, work_date)`, so that a rerun of the job cannot create duplicate absences.
>
> **Frontend Designer / Developer note:** Flowchart 3 sets the states the mobile Scan screen must render. These are the five pre-scan health-check codes, the non-kiosk-QR message, and the success overlay and failure overlay for each server code (Tamagui overlay, haptics, English and Filipino text). Flowcharts 1 and 5 require disabled buttons with visible hints. In flowchart 1, Submit stays disabled until consent is given, Approve until a schedule is chosen, and Reject until a reason is entered. In flowchart 5, Reject stays disabled until remarks are entered. Flowchart 2 defines four variants of the mobile Blocked screen: pending, rejected with reason, inactive, and wrong role.
>
> **System Administrator note:** Flowchart 7's offline alert depends on the every-minute pg_cron job and Realtime on `stations`. Both must be enabled in production (Phase 6 go-live checklist). The job in flowchart 8 is scheduled in UTC (`5 20 * * *`), which equals 04:05 Asia/Manila.
