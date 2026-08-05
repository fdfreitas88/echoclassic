const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

const OPTIONS = [
  { key: 'recent', label: 'Recently added' },
  { key: 'name', label: 'Album' },
  { key: 'artist', label: 'Artist' }
];

function rect(over) {
  return Object.assign({ left: 200, right: 236, top: 100, bottom: 136 }, over || {});
}

/* The menu opens below its icon and right-aligned to it. Left-aligned would
   hang over the list the icon sits above; the toolbar is at the pane's left
   edge, so there is always room to the right of the anchor and rarely to the
   left of it. */
test('the menu opens below the icon, right-aligned to it', function () {
  const { self } = helpers.sortMenuInstance(
    { innerWidth: 1280, innerHeight: 900 }, { options: OPTIONS, value: 'name' });
  self.ui.sortAnchor = rect();
  self.$refs.menu = { scrollHeight: 240, querySelectorAll: () => [] };
  self.position();

  assert.equal(self.menuStyle.width, '260px');
  assert.equal(self.menuStyle.top, '142px', 'six pixels under the icon');
  assert.equal(self.menuStyle.left, '8px',
    'right-aligned to the icon would start at -24, so it clamps to the margin');
});

/* With the icon near the bottom the menu would run off the screen, so it flips
   above -- the same rule the row-actions sheet follows. */
test('it flips above the icon when there is no room below', function () {
  const { self } = helpers.sortMenuInstance(
    { innerWidth: 1280, innerHeight: 400 }, { options: OPTIONS, value: 'name' });
  self.ui.sortAnchor = rect({ top: 320, bottom: 356 });
  self.$refs.menu = { scrollHeight: 240, querySelectorAll: () => [] };
  self.position();

  const top = parseInt(self.menuStyle.top, 10);
  assert.ok(top < 320, 'the menu sits above the icon, not under it: ' + top);
  assert.ok(top >= 8, 'and never past the viewport margin');
});

/* A narrow phone cannot fit the 260px menu, and clamping to the viewport keeps
   both edges on screen instead of letting it hang off the right. */
test('on a narrow screen it shrinks and stays inside the viewport', function () {
  const { self } = helpers.sortMenuInstance(
    { innerWidth: 320, innerHeight: 700 }, { options: OPTIONS, value: 'name' });
  self.ui.sortAnchor = rect({ left: 280, right: 316 });
  self.$refs.menu = { scrollHeight: 200, querySelectorAll: () => [] };
  self.position();

  const left = parseInt(self.menuStyle.left, 10);
  const width = parseInt(self.menuStyle.width, 10);
  assert.equal(width, 260, 'the menu is already narrower than the viewport allows');
  assert.ok(left >= 8, 'the left edge clears the margin: ' + left);
  assert.ok(left + width <= 312, 'and the right edge stays on screen: ' + (left + width));
});

/* Choosing reports the key and closes. Reversing reports the change and stays
   open, because reversing is usually the second half of one decision. */
test('choosing closes the menu; reversing keeps it open', function () {
  const { self } = helpers.sortMenuInstance({}, { options: OPTIONS, value: 'name' });
  let closed = 0;
  self.ui.sortMenu = true;
  self.close = function () { closed++; };

  self.choose('artist');
  assert.deepEqual(self.emitted[0], ['choose', 'artist']);
  assert.equal(closed, 1, 'picking a key is the end of the interaction');

  self.toggleDirection();
  assert.deepEqual(self.emitted[1], ['direction', undefined]);
  assert.equal(closed, 1, 'reversing does not close');
});

/* The native select gave keyboard navigation away for free; this has to
   provide it. Arrow keys wrap at both ends. */
test('arrow keys move between options and wrap', function () {
  const { self, ctx } = helpers.sortMenuInstance({}, { options: OPTIONS, value: 'name' });
  const focused = [];
  const nodes = OPTIONS.map(function (o, i) {
    return { name: o.key, offsetParent: {}, focus: function () { focused.push(i); } };
  });
  self.focusable = function () { return nodes; };

  ctx.document.activeElement = nodes[0];
  self.step(1);
  assert.deepEqual(focused, [1], 'down moves to the next option');

  ctx.document.activeElement = nodes[2];
  self.step(1);
  assert.deepEqual(focused, [1, 0], 'and wraps from the last back to the first');

  ctx.document.activeElement = nodes[0];
  self.step(-1);
  assert.deepEqual(focused, [1, 0, 2], 'up from the first wraps to the last');
});

/* Every option has to be reachable by name in the dictionary: a menu whose
   labels are built in JavaScript is exactly where translations get lost. */
test('every sort label has an entry in strings.txt', function () {
  const text = helpers.read('EchoClassic/strings.txt');
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  const block = src.split('sortOptions: function ()')[1].split('},')[0];
  const labels = (block.match(/this\.tr\('([^']+)'\)/g) || [])
    .map(function (m) { return m.slice(9, -2); });

  assert.ok(labels.length >= 6, 'expected the option labels; found ' + labels.length);
  labels.forEach(function (label) {
    assert.ok(text.indexOf('\tEN\t' + label + '\n') >= 0,
      'sort label missing from strings.txt: ' + label);
  });
});
