const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const skin = path.join(root, 'EchoClassic', 'HTML', 'echoclassic', 'html');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function browserContext(extra) {
  const ctx = Object.assign({
    console,
    setTimeout,
    clearTimeout,
    Promise,
    Error,
    Math,
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    RegExp,
    parseFloat,
    parseInt,
    isFinite,
    encodeURIComponent
  }, extra || {});
  ctx.window = ctx;
  ctx.globalThis = ctx;
  return ctx;
}

function runBrowserFile(rel, extra) {
  const ctx = browserContext(extra);
  vm.runInNewContext(read(rel), ctx, { filename: rel });
  return ctx;
}

function runInContext(ctx, rel) {
  vm.runInNewContext(read(rel), ctx, { filename: rel });
  return ctx;
}

function templates() {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  }
  walk(path.join(skin, 'js'));
  const out = [];
  files.sort().forEach(function (file) {
    const src = fs.readFileSync(file, 'utf8');
    const re = /template:\s*`([\s\S]*?)`\s*,\n/g;
    let match;
    while ((match = re.exec(src))) {
      out.push({
        file: path.relative(root, file),
        template: match[1]
      });
    }
  });
  return out;
}

module.exports = {
  root,
  skin,
  read,
  browserContext,
  runBrowserFile,
  runInContext,
  templates
};
