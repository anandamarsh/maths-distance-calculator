import { test, expect } from "@playwright/test";

test("Chinese locale: PDF generates without errors (no 'widths' crash)", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => {
    console.error("pageerror:", error.message);
    pageErrors.push(error);
  });

  // Set Chinese locale and pre-fill email before navigating
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("lang", "zh");
    localStorage.setItem("reportEmail", "test@example.com");
    localStorage.setItem("reportName", "小明");
  });
  await page.reload();

  // Verify Chinese strings are active
  await expect(
    page.locator('button[title="重新开始"]')
  ).toBeVisible({ timeout: 10_000 });

  // Intercept the send-report API call to capture the request
  let pdfBase64: string | null = null;
  let apiCallMade = false;
  await page.route("**/api/send-report", async (route) => {
    const body = route.request().postDataJSON() as Record<string, string>;
    pdfBase64 = body.pdfBase64 || null;
    apiCallMade = true;
    // Abort the actual network call — we only care that PDF was generated
    await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
  });

  // Activate continuous autopilot
  for (const digit of "198081") {
    await page.keyboard.press(digit);
    await page.waitForTimeout(25);
  }

  // Wait for Level 1 to complete — in Chinese: "第 1 关通关！"
  await expect(
    page.getByText(/第\s*1\s*关通关|Level 1 Clear/)
  ).toBeVisible({ timeout: 180_000 });

  // Wait for the API call (autopilot sends email automatically)
  await page.waitForFunction(() => true); // tick
  await page.waitForTimeout(20_000); // give time for PDF + API

  await page.screenshot({ path: "test-results/chinese-pdf-debug.png", fullPage: true });

  // Check no JS errors occurred (especially the 'widths' crash)
  const fatalErrors = pageErrors.filter((e) =>
    e.message.includes("widths") ||
    e.message.includes("Cannot read properties of undefined") ||
    e.message.includes("Cannot read property")
  );
  console.log("All page errors:", pageErrors.map(e => e.message));

  expect(fatalErrors, "No fatal PDF errors").toHaveLength(0);

  // The API must have been called, meaning the PDF was successfully generated
  expect(apiCallMade, "API was called (PDF was generated)").toBe(true);

  // The PDF must contain actual data (not empty)
  expect(pdfBase64, "PDF base64 is non-null").not.toBeNull();
  expect((pdfBase64 ?? "").length, "PDF base64 has content").toBeGreaterThan(1000);
});
