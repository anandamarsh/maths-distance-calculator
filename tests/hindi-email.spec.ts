import { test, expect } from "@playwright/test";

test("Hindi locale: autopilot sends real email report to amarsh.anand@gmail.com", async ({ page }) => {
  page.on("pageerror", (error) => console.error("pageerror:", error));

  // Set Hindi locale before navigating
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("lang", "hi"));
  await page.reload();

  // Verify locale was applied
  const lang = await page.evaluate(() => localStorage.getItem("lang"));
  expect(lang).toBe("hi");

  // Verify Hindi strings are active in the UI
  await expect(page.locator('button[title="फिर से शुरू करें"]')).toBeVisible({ timeout: 10_000 });

  // Listen for the send-report API call (let it pass through to the real server)
  const emailSentTo: string[] = [];
  await page.route("**/api/send-report", async (route) => {
    const body = route.request().postDataJSON() as Record<string, string>;
    emailSentTo.push(body.email || "");
    await route.continue(); // let the real call through
  });

  // Activate continuous autopilot
  for (const digit of "198081") {
    await page.keyboard.press(digit);
    await page.waitForTimeout(25);
  }

  // Wait for Level 1 to complete — autopilot fills email and sends
  await expect(page.getByText("Level 1 Complete!")).toBeVisible({ timeout: 180_000 });

  // Wait for the API call to be made (autopilot sends email automatically)
  await page.waitForFunction(() => {
    // Check if the API was called by waiting for the email sent signal
    return true; // Will be checked via emailSentTo array
  });
  await page.waitForTimeout(10_000); // Give time for the autopilot to send and API to respond

  // Verify the real email was sent to the correct address
  expect(emailSentTo.length).toBeGreaterThanOrEqual(1);
  expect(emailSentTo[0]).toBe("amarsh.anand@gmail.com");
});
