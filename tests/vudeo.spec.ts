import { expect, test } from "@playwright/test";

test.describe("Vudeo Recording", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const realSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
        const nextTimeout =
          typeof timeout === "number" && timeout >= 100
            ? Math.max(10, Math.round(timeout * 0.02))
            : timeout;
        return realSetTimeout(handler, nextTimeout, ...args);
      }) as typeof window.setTimeout;

      const realAnchorClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function() {
        if (this.download) {
          (window as Window & {
            __lastDownload?: { download: string; href: string };
          }).__lastDownload = {
            download: this.download,
            href: this.href,
          };
        }
        return realAnchorClick.call(this);
      };

      class FakeTrack {
        kind: string;
        enabled = true;
        readyState = "live";
        private listeners = new Map<string, Array<() => void>>();

        constructor(kind: string) {
          this.kind = kind;
        }

        stop() {
          this.readyState = "ended";
          this.dispatchEvent("ended");
        }

        addEventListener(type: string, listener: () => void) {
          const current = this.listeners.get(type) ?? [];
          current.push(listener);
          this.listeners.set(type, current);
        }

        removeEventListener(type: string, listener: () => void) {
          const current = this.listeners.get(type) ?? [];
          this.listeners.set(type, current.filter((item) => item !== listener));
        }

        dispatchEvent(type: string) {
          for (const listener of this.listeners.get(type) ?? []) listener();
        }
      }

      class FakeMediaStream {
        private videoTrack = new FakeTrack("video");
        private audioTrack = new FakeTrack("audio");

        getTracks() {
          return [this.videoTrack, this.audioTrack];
        }

        getVideoTracks() {
          return [this.videoTrack];
        }
      }

      class FakeMediaRecorder {
        static isTypeSupported() {
          return true;
        }

        state: "inactive" | "recording" = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;

        start() {
          this.state = "recording";
        }

        stop() {
          if (this.state !== "recording") return;
          this.state = "inactive";
          window.setTimeout(() => {
            this.ondataavailable?.({ data: new Blob(["vudeo"], { type: "video/webm" }) });
            this.onstop?.();
          }, 0);
        }
      }

      Object.defineProperty(window.navigator, "mediaDevices", {
        configurable: true,
        value: {
          getDisplayMedia: async () => new FakeMediaStream(),
        },
      });

      Object.defineProperty(window, "MediaRecorder", {
        configurable: true,
        value: FakeMediaRecorder,
      });
    });
  });

  test("localhost toolbar shows the vudeo button", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('button[title="Record demo video"]')).toBeVisible();
  });

  test("intro and outro standalone templates load their icons", async ({ page }) => {
    await page.goto("/intro.html");
    await expect(page.locator('img[alt="Trail Distances icon"]')).toHaveJSProperty("complete", true);
    await expect
      .poll(async () => {
        return await page.locator('img[alt="Trail Distances icon"]').evaluate((img) => {
          return (img as HTMLImageElement).naturalWidth;
        });
      })
      .toBeGreaterThan(0);

    await page.goto("/outro.html");
    await expect(page.locator('img[alt="Interactive Maths icon"]')).toHaveJSProperty("complete", true);
    await expect
      .poll(async () => {
        return await page.locator('img[alt="Interactive Maths icon"]').evaluate((img) => {
          return (img as HTMLImageElement).naturalWidth;
        });
      })
      .toBeGreaterThan(0);
  });

  test("starting recording shows the intro overlay and then enters gameplay recording", async ({ page }) => {
    await page.goto("/");

    await page.locator('button[title="Record demo video"]').click();

    await expect(page.getByTestId("vudeo-overlay-intro")).toBeVisible();
    await expect(page.locator('button[title="Record demo video"]')).toBeHidden();

    const introFrame = page.frameLocator('iframe[title="Vudeo intro screen"]');
    await expect(introFrame.getByText("Trail Distances")).toBeVisible();
    await expect(introFrame.getByText("Stage 3 (Years 5-6)")).toBeVisible();
    await expect(introFrame.locator('img[alt="Trail Distances icon"]')).toHaveJSProperty("complete", true);
    await expect
      .poll(async () => {
        return await introFrame.locator('img[alt="Trail Distances icon"]').evaluate((img) => {
          return (img as HTMLImageElement).naturalWidth;
        });
      })
      .toBeGreaterThan(0);

    await page.waitForTimeout(400);
    await expect(page.getByTestId("vudeo-recording-indicator")).toBeVisible();
  });

  test("recording completes end-to-end and downloads the webm", async ({ page }) => {
    await page.goto("/");

    await page.locator('button[title="Record demo video"]').click();

    await expect(page.getByTestId("vudeo-overlay-intro")).toBeVisible();
    await expect(page.getByTestId("vudeo-recording-indicator")).toBeVisible();

    await page.waitForFunction(() => {
      return Boolean(
        (window as Window & {
          __lastDownload?: { download: string };
        }).__lastDownload?.download,
      );
    }, { timeout: 90_000 });

    const downloadedFileName = await page.evaluate(() => {
      return (
        (window as Window & {
          __lastDownload?: { download: string };
        }).__lastDownload?.download ?? null
      );
    });
    expect(downloadedFileName).toMatch(/^trail-distances-vudeo-.*\.webm$/);

    await expect(page.getByTestId("vudeo-recording-indicator")).toBeHidden();
    await expect(page.getByTestId("vudeo-overlay-intro")).toBeHidden();
    await expect(page.getByTestId("vudeo-overlay-outro")).toBeHidden();
  });
});
