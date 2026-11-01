import { expect, test, type Page } from "@playwright/test";

import { ACCOUNTS, login, logout } from "./helpers";

// Responsive check (NFR: usable on phones, tablets and desktops): every page renders at three
// widths without the page itself scrolling sideways. Wide tables may scroll inside their own
// container; that is allowed. A full-page screenshot per page and width goes to test-results/.

const VIEWPORTS = [
  { name: "phone", width: 360, height: 740 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

const PAGES: Record<"public" | keyof typeof ACCOUNTS, string[]> = {
  public: ["/login", "/register", "/privacy"],
  admin: [
    "/admin",
    "/admin/approvals",
    "/admin/employees",
    "/admin/employees/*",
    "/admin/attendance",
    "/admin/corrections",
    "/admin/fallback-scan",
    "/admin/reports",
    "/admin/dtr",
    "/admin/schedules",
    "/admin/holidays",
    "/admin/stations",
    "/admin/device-health",
    "/admin/error-logs",
    "/admin/audit-log",
    "/admin/settings",
  ],
  kiosk: ["/kiosk"],
  employee: ["/me"],
  viewer: ["/viewer", "/viewer/reports"],
};

/** Elements whose right edge passes the viewport, outside any horizontally scrollable box. */
async function overflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= width + 1) return [];
    const scrollsSideways = (el: Element | null): boolean => {
      for (let p = el?.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (
          (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") &&
          p !== document.body
        )
          return true;
      }
      return false;
    };
    const hits: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= width + 1 || scrollsSideways(el)) continue;
      const id = el.id ? `#${el.id}` : "";
      const cls =
        typeof el.className === "string"
          ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
          : "";
      hits.push(`${el.tagName.toLowerCase()}${id}${cls} right=${Math.round(r.right)}`);
      if (hits.length >= 5) break;
    }
    return hits.length ? hits : [`scrollWidth=${document.documentElement.scrollWidth} > ${width}`];
  });
}

async function resolvePath(page: Page, path: string): Promise<string> {
  if (!path.endsWith("/*")) return path;
  await page.goto(path.slice(0, -2));
  const href = await page
    .locator(`a[href^="${path.slice(0, -1)}"]`)
    .first()
    .getAttribute("href");
  expect(href, `a link to ${path}`).toBeTruthy();
  return href!;
}

for (const vp of VIEWPORTS) {
  test.describe(`responsive @ ${vp.name} ${vp.width}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const [who, paths] of Object.entries(PAGES)) {
      test(`${who} pages fit the screen`, async ({ page }) => {
        test.setTimeout(240_000);
        if (who !== "public") await login(page, ACCOUNTS[who as keyof typeof ACCOUNTS]);
        const problems: string[] = [];
        for (const raw of paths) {
          const path = await resolvePath(page, raw);
          await page.goto(path);
          await page.waitForLoadState("networkidle").catch(() => undefined);
          const hits = await overflowingElements(page);
          if (hits.length) problems.push(`${path}: ${hits.join(", ")}`);
          await page.screenshot({
            path: test.info().outputPath(`${vp.name}${path.replace(/\//g, "_")}.png`),
            fullPage: true,
          });
        }
        if (who !== "public") await logout(page);
        expect(problems, problems.join("\n")).toEqual([]);
      });
    }
  });
}
