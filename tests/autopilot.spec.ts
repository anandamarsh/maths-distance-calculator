import { expect, test } from "@playwright/test";

async function activateAutopilot(page: Parameters<typeof test>[0]["page"]) {
  for (const digit of "198081") {
    await page.keyboard.press(digit);
    await page.waitForTimeout(25);
  }

  await expect(
    page.locator('[aria-label="Autopilot active — click to cancel"]'),
  ).toBeVisible();
}

test("198081 runs the full phantom autopilot flow", async ({ page }) => {
  let emailSendCount = 0;

  page.on("pageerror", (error) => {
    console.error("pageerror:", error);
  });

  await page.route("**/api/send-report", async (route) => {
    emailSendCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto("/");

  const dino = page.getByTestId("dino-token").first();
  await expect(dino).toBeVisible();
  const startBox = await dino.boundingBox();
  expect(startBox).not.toBeNull();

  await activateAutopilot(page);

  await page.waitForTimeout(1200);
  const movedBox = await dino.boundingBox();
  expect(movedBox).not.toBeNull();
  expect(movedBox!.x !== startBox!.x || movedBox!.y !== startBox!.y).toBeTruthy();

  await expect(page.getByText("Level 1 Complete!")).toBeVisible({
    timeout: 180_000,
  });
  await expect(page.getByText("Level 2 Complete!")).toBeVisible({
    timeout: 240_000,
  });
  await expect(page.getByText("You Did It!")).toBeVisible({
    timeout: 360_000,
  });

  await expect(
    page.locator('[aria-label="Autopilot active — click to cancel"]'),
  ).toHaveCount(0);
  expect(emailSendCount).toBeGreaterThanOrEqual(3);
});

test("198081 activates correctly when starting directly on level 2", async ({ page }) => {
  await page.route("**/api/send-report", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto("/?level=2");

  await expect(page.getByTestId("dino-token").first()).toBeVisible();
  await activateAutopilot(page);
  await expect(page.getByText("You Did It!")).toBeVisible({
    timeout: 360_000,
  });
});

test("198081 activates correctly when starting directly on level 3", async ({ page }) => {
  await page.route("**/api/send-report", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto("/?level=3");

  await activateAutopilot(page);
  await expect(page.getByText("You Did It!")).toBeVisible({
    timeout: 240_000,
  });
});
