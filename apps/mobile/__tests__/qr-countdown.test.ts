import { qrCountdown, retryDelayMs, serverOffset } from "@/components/qr/countdown";

describe("personal QR countdown (server time)", () => {
  const token = { serverNow: 1_000_000, expiresAt: 1_030_000, refreshSeconds: 15 };

  it("computes the server offset from the request midpoint", () => {
    // Phone clock is 2 minutes behind; request took 400 ms.
    expect(serverOffset(1_000_000, 880_000 - 200, 880_000 + 200)).toBe(120_000);
  });

  it("counts down to the next refresh on server time even when the phone clock is wrong", () => {
    const offset = 120_000; // phone is 2 min behind the server
    const phoneNow = 1_000_000 - offset + 5_000; // 5 s after issue, in phone time
    const c = qrCountdown(token, phoneNow, offset);
    expect(c.secondsLeft).toBe(10);
    expect(c.refreshInMs).toBe(10_000);
    expect(Math.round(c.percent)).toBe(67);
    expect(c.expired).toBe(false);
  });

  it("is due (0 s) at the refresh time and expired after expiresAt", () => {
    expect(qrCountdown(token, 1_015_000, 0)).toMatchObject({ secondsLeft: 0, percent: 0, expired: false });
    expect(qrCountdown(token, 1_031_000, 0)).toMatchObject({ secondsLeft: 0, expired: true });
  });

  it("never refreshes later than the token expiry", () => {
    const short = { serverNow: 0, expiresAt: 10_000, refreshSeconds: 15 };
    expect(qrCountdown(short, 0, 0).refreshInMs).toBe(10_000);
  });

  it("backs off after failed refreshes", () => {
    expect([1, 2, 3, 4, 5].map(retryDelayMs)).toEqual([5_000, 10_000, 20_000, 40_000, 60_000]);
  });
});
