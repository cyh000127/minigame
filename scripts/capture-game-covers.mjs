import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const outputDir = join(rootDir, 'public', 'game-covers');
const baseUrl = process.env.CAPTURE_BASE_URL ?? 'http://127.0.0.1:5173';
const viewport = { width: 1440, height: 960 };
const gameSlugs = readdirSync(join(rootDir, 'games'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
});

for (const slug of gameSlugs) {
  const page = await browser.newPage({ viewport });
  const url = `${baseUrl}/games/${slug}/index.html`;

  try {
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 20_000,
    });

    await page.addStyleTag({
      content: `
        * {
          caret-color: transparent !important;
        }
      `,
    });

    await settleForScreenshot(page, slug);
    await page.screenshot({
      path: join(outputDir, `${slug}.png`),
      type: 'png',
    });
    console.log(`Captured ${slug}`);
  } catch (error) {
    console.error(`Failed to capture ${slug}:`, error);
  } finally {
    await page.close();
  }
}

await browser.close();

async function settleForScreenshot(page, slug) {
  await page.waitForTimeout(900);

  const selectors = [
    '[data-action="start"]',
    '[data-start]',
    'button:has-text("Start")',
    'button:has-text("New Game")',
    'button:has-text("RUN")',
    'button:has-text("시작")',
  ];

  for (const selector of selectors) {
    const button = page.locator(selector).first();
    if (await button.count()) {
      try {
        await button.click({ timeout: 1000 });
        await page.waitForTimeout(800);
        break;
      } catch {
        // Ignore and try the next interaction path.
      }
    }
  }

  if (slug === 'quoridor') {
    await page.waitForTimeout(1500);
  }

  try {
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
  } catch {
    // Ignore.
  }

  try {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
  } catch {
    // Ignore.
  }
}
