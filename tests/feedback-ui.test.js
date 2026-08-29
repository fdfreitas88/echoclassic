'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('messages render in the workspace before Recently played content', function () {
  const app = helpers.read('EchoClassic/HTML/echoclassic/html/js/app.js');
  const browse = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  assert.ok(app.indexOf('class="feedback-region"') < app.indexOf('<div class="body"'));
  assert.match(browse, /<div class="sectitle">Recently played<\/div>/);
  assert.doesNotMatch(app, /<button v-if="ui\.notice" class="notice"/,
    'the entire notification must not masquerade as an unlabeled button');
});

test('feedback distinguishes persistent errors and exposes an explicit close action', function () {
  const app = helpers.read('EchoClassic/HTML/echoclassic/html/js/app.js');
  const ui = helpers.read('EchoClassic/HTML/echoclassic/html/js/ui.js');
  assert.match(app, /:role="ui\.noticeKind === 'error' \? 'alert' : 'status'"/);
  assert.match(app, /aria-label="Dismiss message"/);
  assert.match(ui, /if \(state\.noticeKind !== 'error'\)/);
});

test('destructive confirmation is app-owned and restores focus to its trigger', function () {
  const app = helpers.read('EchoClassic/HTML/echoclassic/html/js/app.js');
  const ui = helpers.read('EchoClassic/HTML/echoclassic/html/js/ui.js');
  assert.match(app, /class="confirm-stage global-confirm" role="dialog"/);
  assert.match(app, /ref="confirmationCancel"/);
  assert.match(ui, /function confirmAction\(options\)/);
  assert.match(ui, /if \(trigger && trigger\.focus\) trigger\.focus\(\)/);
});
