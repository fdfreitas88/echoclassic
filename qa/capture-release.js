'use strict';
const path = require('node:path');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const url = process.env.ECHO_E2E_BASE_URL;
if (!url) throw new Error('ECHO_E2E_BASE_URL is required');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 1, locale: 'en-US', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const mutations = [];
    page.on('request', req => {
      if (!req.url().includes('jsonrpc.js') || !req.postData()) return;
      const c = JSON.parse(req.postData()).params[1];
      if (['playlistcontrol','playlist','play','pause','stop','mixer','restartserver'].includes(c[0])) mutations.push(c);
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.LmsStore && LmsStore.state.initialized && LmsStore.state.players.length);
    const version = await page.evaluate(() => LMS_SKIN_VERSION);
    if (version !== '3.5.11') throw new Error('Expected live 3.5.11, got ' + version);
    await page.evaluate(async () => {
      const p = LmsStore.state.players.find(p => p.connected && /Apple Squeezer Intel/.test(p.name));
      if (!p) throw new Error('Representative queued player unavailable');
      await LmsStore.selectPlayer(p.id);
      LmsUi.state.showBadges = true;
      LmsUi.openPlayer();
    });
    await page.locator('.npfull .cover img').first().waitFor({ state: 'visible' });
    await page.waitForFunction(() => [...document.querySelectorAll('.npfull .cover img')].some(img => img.complete && img.naturalWidth > 0));
    await page.screenshot({ path: path.join(root, 'images/release-3.5.11-player-phone.png') });
    await page.evaluate(() => { LmsUi.closePlayer(); LmsNav.reset('playlists'); LmsUi.setTab('playlists'); });
    const row = page.locator('.newpl').locator('..').locator('button.row').filter({ hasText: 'Qobuz:' }).first();
    await row.click({ timeout: 30000 });
    await page.locator('.trow').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.locator('.trow-main').first().click();
    await page.screenshot({ path: path.join(root, 'images/release-3.5.11-playlist-phone.png') });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => LmsUi.setTab('collection'));
    await page.locator('.collection-screen').waitFor({ state: 'visible' });
    if (await page.getByRole('button', { name: 'Scan folders', exact: true }).count()) {
      await page.getByRole('button', { name: 'Scan folders', exact: true }).click();
    }
    await page.waitForFunction(() => LmsLibraryDisplay.state.collection && LmsLibraryDisplay.state.collection.complete && !LmsCollectionCache.state.busy, null, { timeout: 120000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.collection-screen').waitFor({ state: 'visible' });
    await page.waitForFunction(() => LmsLibraryDisplay.state.collection && LmsLibraryDisplay.state.collection.complete);
    await page.screenshot({ path: path.join(root, 'images/release-3.5.11-collection-desktop.png') });
    if (mutations.length) throw new Error('Unexpected playback mutation: ' + JSON.stringify(mutations));
    console.log(JSON.stringify({ version, images: 3, playbackMutations: 0, collectionTracks: await page.evaluate(() => LmsLibraryDisplay.state.collection.rows.length) }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
