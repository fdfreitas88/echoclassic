const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const skin = path.join(__dirname, '../EchoClassic/HTML/echoclassic/html');

async function openCandidate(page) {
  if (!process.env.ECHO_QA_USE_DEPLOYED) await page.route('**/echoclassic/html/**', async route => {
    const relative = new URL(route.request().url()).pathname.split('/echoclassic/html/')[1];
    const file = path.resolve(skin, relative || '');
    if (file.startsWith(skin + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      await route.fulfill({ path: file });
    } else await route.continue();
  });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app')).toBeVisible();
}

test('idle and populated player labels remain within the bar', async ({ page }) => {
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="fixture"><lms-miniplayer></lms-miniplayer></div>');
  await page.addStyleTag({ path: path.join(skin, 'css/ios9.css') });
  await page.addScriptTag({ path: path.join(skin, 'lib/vue.min.js') });
  await page.evaluate(() => {
    window.LmsStore = { state: Vue.observable({ np: {}, mode: 'stop', volume: 50,
      duration: 200, time: 0, commandable: true, equalizer: { status: 'idle' } }) };
    window.LmsUi = { state: Vue.observable({ full: false, showBadges: false }) };
  });
  await page.addScriptTag({ path: path.join(skin, 'js/format.js') });
  await page.addScriptTag({ path: path.join(skin, 'js/chrome/miniplayer.js') });
  await page.evaluate(() => { new Vue({ el: '#fixture' }); });
  for (const width of [1440, 1190, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ['idle', 'play', 'pause']) {
      await page.evaluate(mode => {
        LmsStore.state.mode = mode;
        LmsStore.state.np = mode === 'idle' ? {} : {
          id: 1, title: 'A long track title '.repeat(20), artist: 'Artist', album: 'Album'
        };
      }, mode);
      const bar = page.locator('.mini');
      const label = page.locator('.mini-copy .t');
      await expect(label).toHaveText(mode === 'idle' ? 'Nothing playing' : 'A long track title '.repeat(20));
      const b = await bar.boundingBox(), l = await label.boundingBox();
      expect(l.y).toBeGreaterThan(b.y);
      expect(l.y + l.height).toBeLessThanOrEqual(b.y + b.height);
      expect(l.x).toBeGreaterThanOrEqual(b.x);
      expect(l.x + l.width).toBeLessThanOrEqual(b.x + b.width);
      expect(await page.locator('.queuebtn').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(43.99);
    }
  }
});

test('saved playlists open against LMS using selected assets', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  // Default to candidate assets; ECHO_QA_USE_DEPLOYED checks the installed build.
  await openCandidate(page);
  await page.evaluate(() => { LmsNav.reset('playlists'); LmsUi.setTab('playlists'); });
  const playlist = page.locator('.newpl').locator('..').locator('button.row').filter({ hasText: 'Qobuz:' }).first();
  await expect(playlist).toBeVisible({ timeout: 30000 });
  const name = await playlist.locator('.t').textContent();
  await playlist.click();
  await expect(page.locator('.playlist-head .big')).toHaveText(name, { timeout: 30000 });
  await expect(page.locator('.trow').first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Playlists unavailable', { exact: true })).toHaveCount(0);
  await page.evaluate(() => LmsNav.back('playlists'));
  await expect(playlist).toBeVisible({ timeout: 30000 });
  expect(errors).toEqual([]);
});

test('Qobuz service playlists open their tracks without sending playback commands', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [], mutations = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('request', request => {
    if (!request.url().includes('jsonrpc.js') || !request.postData()) return;
    const cmd = JSON.parse(request.postData()).params[1];
    if (cmd[0] === 'qobuz' && cmd[1] === 'playlist') mutations.push(cmd);
  });
  await openCandidate(page);
  await page.evaluate(() => { LmsNav.reset('apps'); LmsUi.setTab('apps'); });
  await page.getByRole('button', { name: 'Qobuz', exact: true }).click({ timeout: 30000 });
  await page.getByRole('button', { name: 'My Playlists', exact: true }).click({ timeout: 30000 });
  const playlist = page.getByRole('button', { name: '80s', exact: true });
  await playlist.click({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /Agora Eu Sei/ })).toBeVisible({ timeout: 30000 });
  expect(mutations).toEqual([]);
  expect(errors).toEqual([]);
});

test('server playlist artwork loads in mini and expanded player without changing playback', async ({ page }) => {
  test.setTimeout(90000);
  await openCandidate(page);
  const track = await page.evaluate(async () => {
    const lists = await LmsApi.playlists(0, 200);
    const list = lists.find(item => item.name.startsWith('Qobuz:'));
    if (!list) throw new Error('The live QA server requires a saved Qobuz playlist');
    const tracks = await LmsApi.playlistTracks(list.id, 0, 20);
    const track = tracks.find(item => item.artworkUrl);
    if (!track) throw new Error('The live playlist must supply explicit artwork_url');
    // Only the test page's view model changes; LMS playback and queue stay intact.
    LmsStore.stopPolling();
    LmsStore.state.np = track;
    return track;
  });
  const mini = page.locator('.mini-cover img');
  await expect(mini).toHaveAttribute('src', track.artworkUrl);
  await expect.poll(() => mini.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => LmsUi.openPlayer());
  const expanded = page.locator('.npfull .cover img').filter({ visible: true }).first();
  await expect(expanded).toHaveAttribute('src', track.artworkUrl);
  await expect.poll(() => expanded.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
});

test('crowded phone player controls remain separate and dispatch their actions', async ({ page }) => {
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="fixture"><lms-miniplayer @full="calls.push(\'full\')" @queue="calls.push(\'queue\')"></lms-miniplayer></div>');
  await page.addStyleTag({ path: path.join(skin, 'css/ios9.css') });
  await page.addScriptTag({ path: path.join(skin, 'lib/vue.min.js') });
  await page.evaluate(() => {
    window.calls = [];
    window.LmsStore = { state: Vue.observable({ np: { id: 1, title: 'For Your Pleasure', artist: 'Roxy Music', album: 'For Your Pleasure (2ch)',
      sampleRate: 192000, sampleSize: 24, bitrate: 9216, format: 'FLAC', isTranscoded: true },
      mode: 'pause', volume: 100, duration: 400, time: 123, commandable: true, replayGainApplied: -3.2,
      equalizer: { status: 'ready' } }), setEqualizerContext: () => calls.push('equalizer-context') };
    for (const action of ['play','pause','stop','next','prev']) LmsStore[action] = () => calls.push(action);
    window.LmsUi = { state: Vue.observable({ full: false, showBadges: true }), openActions: () => calls.push('player-picker'), setTab: () => calls.push('settings') };
    window.LmsNav = { push: () => calls.push('equalizer') };
  });
  await page.addScriptTag({ path: path.join(skin, 'js/format.js') });
  await page.addScriptTag({ path: path.join(skin, 'js/chrome/miniplayer.js') });
  await page.evaluate(() => { new Vue({ el: '#fixture', data: { calls } }); });
  for (const width of [320,360,380,381,393,412,560]) {
    await page.setViewportSize({ width, height: 851 });
    await page.evaluate(() => { calls.length = 0; LmsStore.state.mode = 'pause'; });
    for (const name of ['Previous track','Play','Stop','Next track','Change player','Equalizer','Playback queue']) {
      const control = page.getByRole('button', { name, exact: true });
      const r = await control.boundingBox();
      // Mobile engines can round a 44px box to 43.999996 CSS pixels.
      expect(r.width).toBeGreaterThanOrEqual(43.99);
      expect(r.height).toBeGreaterThanOrEqual(43.99);
      await control.click();
    }
    await page.locator('.mini-volume-command').click();
    await page.locator('.mini .np').click();
    await page.evaluate(() => LmsStore.state.mode = 'play');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    expect(await page.evaluate(() => calls)).toEqual(['prev','play','stop','next','player-picker','equalizer-context','settings','equalizer','queue','full','full','pause']);
  }
});
