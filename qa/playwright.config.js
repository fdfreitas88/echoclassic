const { defineConfig, devices } = require('@playwright/test');
const { firefoxLaunchOptions } = require('./firefox-launch');

const baseURL = process.env.ECHO_E2E_BASE_URL;
if (!baseURL) {
  throw new Error('Set ECHO_E2E_BASE_URL to the real Echo Classic URL, for example http://musicplayer.local:9000/echoclassic/');
}

module.exports = defineConfig({
  testDir: __dirname,
  outputDir: 'results',
  snapshotDir: 'snapshots',
  fullyParallel: false,
  /* LMS and mDNS are intentionally exercised as real services. Serial runs
     avoid three browser engines stampeding discovery during server startup. */
  workers: 1,
  retries: 1,
  reporter: [['list'], ['html', { outputFolder: 'report', open: 'never' }]],
  use: {
    baseURL,
    launchOptions: { timeout: 30000 },
    locale: 'en-US',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 }, launchOptions: firefoxLaunchOptions() } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } } },
    { name: 'android-chrome-emulated', use: { ...devices['Pixel 5'], channel: 'chrome' } },
    // Firefox cannot emulate isMobile; this covers narrow layouts and touch in
    // desktop Gecko. Actual Android GeckoView remains a device acceptance check.
    { name: 'android-firefox-viewport', use: { ...devices['Desktop Firefox'], viewport: { width: 393, height: 851 }, hasTouch: true, deviceScaleFactor: 2.75, launchOptions: firefoxLaunchOptions() } },
    { name: 'tablet-webkit', use: { ...devices['iPad (gen 7)'] } },
    { name: 'phone-webkit', use: { ...devices['iPhone 13'] } }
  ]
});
