const { test, expect } = require('@playwright/test');

// Read-only audit of the deployed build. Ellipsis is reported separately from
// off-screen controls or clipped text without an intentional truncation style.
async function audit(page, name, testInfo, reports) {
  const report = await page.evaluate(() => {
    const width = innerWidth;
    const visible = el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      if (!r.width || !r.height || r.bottom <= 0 || r.top >= innerHeight || s.visibility === 'hidden') return false;
      for (let p = el; p; p = p.parentElement) if (getComputedStyle(p).display === 'none') return false;
      return true;
    };
    const describe = el => ({ tag: el.tagName, class: el.className,
      text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 160) });
    const controls = [...document.querySelectorAll('button,input,select')].filter(visible)
      .filter(el => !el.closest('.visually-hidden'))
      .filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > width + 1; }).map(describe);
    const truncated = [], clipped = [];
    for (const el of document.querySelectorAll('span,strong,small,button,div,h2,h3,label')) {
      if (!visible(el) || el.closest('.visually-hidden') || !el.textContent.trim()) continue;
      if ([...el.children].some(child => child.textContent.trim())) continue;
      if (el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1) continue;
      const s = getComputedStyle(el);
      if (!['hidden', 'clip'].includes(s.overflowX) && !['hidden', 'clip'].includes(s.overflowY)) continue;
      const item = { ...describe(el), client: [el.clientWidth, el.clientHeight], scroll: [el.scrollWidth, el.scrollHeight] };
      (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none' ? truncated : clipped).push(item);
    }
    return { width, pageOverflow: document.documentElement.scrollWidth > width + 1, controls, truncated, clipped };
  });
  reports.push({ screen: name, ...report });
  expect(report.pageOverflow, name + ' horizontal overflow').toBe(false);
  expect(report.controls, name + ' off-screen controls').toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`${name}-${report.width}.png`) });
}

test('phone text and controls audit', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const reports = [];
  if (!process.env.ECHO_QA_USE_DEPLOYED) await page.route('**/echoclassic/html/**', async route => {
    const fs = require('node:fs'), path = require('node:path');
    const skin = path.resolve(__dirname, '../EchoClassic/HTML/echoclassic/html');
    const relative = new URL(route.request().url()).pathname.split('/echoclassic/html/')[1];
    const file = path.resolve(skin, relative || '');
    if (file.startsWith(skin + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) await route.fulfill({ path: file });
    else await route.continue();
  });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate(() => {
    LmsStore.stopPolling();
    Object.assign(LmsStore.state, { np: { id: 1, title: 'For Your Pleasure', artist: 'Roxy Music',
      album: 'For Your Pleasure (2ch)', sampleRate: 192000, sampleSize: 24, bitrate: 9216, format: 'FLAC', isTranscoded: true },
      duration: 400, time: 123, replayGainApplied: -3.2, volume: 100, mode: 'pause', commandable: true });
    LmsStore.state.equalizer.status = 'ready';
    LmsUi.state.showBadges = true;
  });
  for (const width of [320, 360, 393, 412]) {
    await page.setViewportSize({ width, height: 851 });
    for (const tab of ['music', 'playlists', 'apps', 'settings', 'more']) {
      await page.evaluate(tab => { LmsUi.closePlayer(); LmsUi.state.queueOpen = false; LmsNav.reset(tab); LmsUi.setTab(tab); }, tab);
      await expect(page.locator('.body-view')).toBeVisible();
      if (tab === 'playlists') await expect(page.locator('.newpl')).toBeVisible({ timeout: 30000 });
      if (tab === 'music') await expect(page.locator('.row').first()).toBeVisible({ timeout: 30000 });
      await audit(page, tab, testInfo, reports);
      if (tab === 'playlists') {
        await page.locator('.newpl').locator('..').locator('button.row').filter({ hasText: 'Qobuz:' }).first().click();
        await expect(page.locator('.trow').first()).toBeVisible({ timeout: 30000 });
        await audit(page, 'playlist-tracks', testInfo, reports);
        await page.getByRole('button', { name: 'Edit', exact: true }).click();
        await page.locator('.trow-main').first().click();
        await expect(page.locator('.trow.chosen')).toHaveCount(1);
        await expect(page.getByRole('button', { name: 'Remove selected', exact: true })).toBeVisible();
        await audit(page, 'playlist-edit', testInfo, reports);
        await page.locator('.playlist-row-remove').first().click();
        await expect(page.locator('.global-confirm')).toBeVisible();
        await page.locator('.global-confirm').getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(page.locator('.global-confirm')).toHaveCount(0);
        const readability = await page.locator('.playlist-screen').evaluate(el =>
          [...el.querySelectorAll('.trow .t,.trow .s')].filter(node => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1).map(node => node.textContent));
        expect(readability, 'playlist editing names must remain readable').toEqual([]);
        const coverGap = await page.locator('.trow-main').first().evaluate(el =>
          el.querySelector('.ell').getBoundingClientRect().left - el.querySelector('.cover').getBoundingClientRect().right);
        expect(coverGap, 'artwork must have space before the track text').toBeGreaterThanOrEqual(11.99);
      }
      if (tab === 'settings') {
        const install = page.locator('.settings-destination-group .v').filter({ hasText: 'Install' }).first();
        if (await install.count()) {
          await install.scrollIntoViewIfNeeded();
          await expect(install).toBeVisible();
          expect(await install.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
          await audit(page, 'settings-install', testInfo, reports);
        }
      }
    }
    await page.evaluate(() => LmsUi.openPlayer());
    await expect(page.locator('.npfull')).toBeVisible();
    await audit(page, 'now-playing', testInfo, reports);
    await page.evaluate(() => { LmsUi.closePlayer(); LmsUi.state.queueOpen = true; });
    await expect(page.locator('.queue')).toBeVisible();
    await audit(page, 'queue', testInfo, reports);
    await page.evaluate(() => { LmsUi.state.queueOpen = false; });
    const crowded = await page.locator('.mini').evaluate(el => {
      const box = el.querySelector('.mini-copy').getBoundingClientRect();
      const controls = [...el.querySelectorAll('button')].map(node => node.getBoundingClientRect());
      const overlap = controls.some((a, i) => controls.slice(i + 1).some(b => Math.min(a.right,b.right) - Math.max(a.left,b.left) > 1 && Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top) > 1));
      const progress = el.querySelector('.mini-progress').getBoundingClientRect();
      return { textWidth: box.width, overlap, progressContained: progress.right <= box.right + 1 && progress.left >= box.left - 1 };
    });
    expect(crowded.textWidth).toBeGreaterThan(230);
    expect(crowded.overlap).toBe(false);
    expect(crowded.progressContained).toBe(true);
  }
  await testInfo.attach('phone-text-audit', { body: JSON.stringify(reports, null, 2), contentType: 'application/json' });
  require('node:fs').writeFileSync(testInfo.outputPath('audit.json'), JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports.map(r => ({ screen: r.screen, width: r.width, pageOverflow: r.pageOverflow, offscreenControls: r.controls.length, clipped: r.clipped.length, truncated: r.truncated.length }))));
});
