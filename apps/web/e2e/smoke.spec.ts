import { expect, test } from "@playwright/test";

test("landing page shows the system title and auth links", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /BHW QR Attendance System/ }),
  ).toBeVisible();
  await expect(page.getByText("Barangay Kalawag II")).toBeVisible();
  await expect(page.getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Register" })).toHaveAttribute("href", "/register");
});
