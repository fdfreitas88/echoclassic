const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const install = fs.readFileSync(path.join(root, 'EchoClassic/install.xml'), 'utf8');
const plugin = fs.readFileSync(path.join(root, 'EchoClassic/Plugin.pm'), 'utf8');
const repository = fs.readFileSync(path.join(root, 'repo.xml'), 'utf8');

function capture(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error('versao ausente em ' + label);
  return match[1];
}

const versions = {
  'install.xml': capture(install, /<version>([^<]+)<\/version>/, 'install.xml'),
  'Plugin.pm': capture(plugin, /getSkinVersion\s*\{\s*return\s+'([^']+)'/, 'Plugin.pm'),
  'repo.xml': capture(repository, /<plugin\s+name="EchoClassic"\s+version="([^"]+)"/, 'repo.xml')
};
const expected = versions['install.xml'];
const mismatches = Object.keys(versions).filter(function (file) {
  return versions[file] !== expected;
});

if (mismatches.length) {
  Object.keys(versions).forEach(function (file) {
    console.error('  ' + file + ': ' + versions[file]);
  });
  process.exit(1);
}

console.log('  versao ' + expected + ' consistente em install.xml, Plugin.pm e repo.xml');
