import { chromium } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create tmp directory if it doesn't exist
const tmpDir = join(__dirname, 'tmp');
await mkdir(tmpDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

// Set viewport for consistent screenshots
await page.setViewportSize({ width: 1400, height: 800 });

// Screenshots to take
const screenshots = [
  { time: 0, desc: 'Normal traffic' },
  { time: 45, desc: 'Bikes entering eastbound' },
  { time: 46, desc: 'Bikes in pen' },
  { time: 50, desc: 'Sweep vehicle eastbound' },
  { time: 55, desc: 'Pace car with queued cars' }
];

for (const { time, desc } of screenshots) {
  console.log(`Taking screenshot at t=${time} - ${desc}`);
  
  await page.goto(`http://localhost:5173/?t=${time}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Wait for animations to settle
  
  const filename = join(tmpDir, `ht_t${time}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`  Saved to ${filename}`);
}

await browser.close();
console.log('\nAll screenshots saved to tmp/ directory');