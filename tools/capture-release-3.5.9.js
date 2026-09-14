#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { chromium } = require('@playwright/test');

const baseURL = process.env.ECHO_E2E_BASE_URL || 'http://musicplayer.local:9000/echoclassic/';
const root = path.join(__dirname, '..');

async function ready(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('.app').waitFor({ state: 'visible' });
  await page.waitForFunction(() => window.LmsUi && window.LmsStore && document.querySelector('.split-body'));
  await page.waitForFunction(() => window.LmsStore.state.players.length > 0);
  await page.evaluate(async () => {
    if (window.LmsStore.state.playerId) return;
    const player = window.LmsStore.state.players.find((item) => item.connected) || window.LmsStore.state.players[0];
    if (player) await window.LmsStore.selectPlayer(player.id);
  });
}

async function shot(page, name) {
  const target = path.join(root, 'images', 'release-3.5.9-' + name + '.png');
  await page.screenshot({ path: target, fullPage: false });
  console.log(target);
}

(async function () {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }, locale: 'en-US',
    colorScheme: 'light', reducedMotion: 'reduce'
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await ready(page);
  const version = await page.evaluate(() => typeof LMS_SKIN_VERSION === 'string' ? LMS_SKIN_VERSION : '');
  if (version !== '3.5.9') throw new Error('Expected deployed 3.5.9, received ' + version);

  await page.evaluate(() => window.LmsUi.setTab('settings'));
  await page.locator('.settings').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /^Equalizer SqueezeDSP/ }).click();
  await page.locator('.equalizer-response').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByRole('radio', { name: 'SqueezeDSP' }).click();
  await page.getByRole('button', { name: 'Warm' }).click();
  await page.waitForTimeout(3800);
  await shot(page, 'equalizer');

  if (errors.length) throw new Error('Page errors: ' + errors.join(' | '));
  await browser.close();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
