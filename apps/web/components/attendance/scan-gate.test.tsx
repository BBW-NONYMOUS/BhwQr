import { describe, expect, it } from "vitest";

import { createScanGate, isPersonalQrContent, SCAN_DEBOUNCE_MS } from "./scan-gate";

const QR_A = "BHWPQR1:eyJ2IjoxfQ.c2lnbmF0dXJl";
const QR_B = "BHWPQR1:eyJ2IjoyfQ.b3RoZXJzaWc";

describe("isPersonalQrContent", () => {
  it("accepts personal QR content only", () => {
    expect(isPersonalQrContent(QR_A)).toBe(true);
    expect(isPersonalQrContent(`  ${QR_A}\n`)).toBe(true);
    expect(isPersonalQrContent("BHWQR1:eyJ2IjoxfQ.c2ln")).toBe(false);
    expect(isPersonalQrContent("https://example.com")).toBe(false);
    expect(isPersonalQrContent("BHWPQR1:")).toBe(false);
    expect(isPersonalQrContent(`BHWPQR1:${"a".repeat(2000)}`)).toBe(false);
  });
});

describe("createScanGate", () => {
  it("accepts the first read and drops repeats within the window", () => {
    const gate = createScanGate();
    expect(gate.check(QR_A, 0)).toBe("accept");
    expect(gate.check(QR_A, 500)).toBe("duplicate");
    expect(gate.check(QR_A, 2999 + 500)).toBe("duplicate");
  });

  it("accepts the same code again once it has been away for the full window", () => {
    const gate = createScanGate();
    expect(gate.check(QR_A, 0)).toBe("accept");
    expect(gate.check(QR_A, SCAN_DEBOUNCE_MS)).toBe("accept");
  });

  it("keeps dropping a code that stays in view (each read refreshes the window)", () => {
    const gate = createScanGate(3000);
    expect(gate.check(QR_A, 0)).toBe("accept");
    for (let t = 1000; t <= 10_000; t += 1000) expect(gate.check(QR_A, t)).toBe("duplicate");
    expect(gate.check(QR_A, 13_000)).toBe("accept");
  });

  it("treats different codes independently", () => {
    const gate = createScanGate();
    expect(gate.check(QR_A, 0)).toBe("accept");
    expect(gate.check(QR_B, 100)).toBe("accept");
  });

  it("reports non-personal codes once per window", () => {
    const gate = createScanGate();
    expect(gate.check("BHWQR1:kiosk.token", 0)).toBe("not_personal_qr");
    expect(gate.check("BHWQR1:kiosk.token", 1000)).toBe("duplicate");
  });

  it("ignores surrounding whitespace and forgets everything on reset", () => {
    const gate = createScanGate();
    expect(gate.check(QR_A, 0)).toBe("accept");
    expect(gate.check(` ${QR_A} `, 100)).toBe("duplicate");
    gate.reset();
    expect(gate.check(QR_A, 200)).toBe("accept");
  });
});
