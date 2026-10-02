const fs = require('node:fs');
const path = require('node:path');
const { firefox } = require('@playwright/test');

// macOS 27 protects the installed Firefox's shared app-data directory. A
// temporary profile alone does not isolate it. Give the QA build its own
// application identity, keeping the user's browser and its protections intact.
// https://github.com/microsoft/playwright/issues/42768
function firefoxLaunchOptions() {
  if (process.platform !== 'darwin') return {};
  const executable = firefox.executablePath();
  if (!fs.existsSync(executable)) return {};
  const bundle = path.resolve(path.dirname(executable), '../..');
  const runtime = path.join(__dirname, '.firefox-runtime', path.basename(path.dirname(path.dirname(bundle))));
  const copy = path.join(runtime, 'Nightly.app');
  const wrapper = path.join(runtime, 'firefox-qa');
  if (!fs.existsSync(wrapper)) {
    fs.mkdirSync(runtime, { recursive: true });
    fs.cpSync(bundle, copy, { recursive: true });
    const resources = path.join(copy, 'Contents/Resources');
    const app = fs.readFileSync(path.join(resources, 'application.ini'), 'utf8')
      .replace(/^Vendor=.*$/m, 'Vendor=EchoClassicQA')
      .replace(/^Name=.*$/m, 'Name=EchoClassicFirefoxQA');
    const ini = path.join(resources, 'browser/application.ini');
    fs.writeFileSync(ini, app);
    const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
    fs.writeFileSync(wrapper, '#!/bin/sh\nexec ' + quote(path.join(copy, 'Contents/MacOS/firefox')) +
      ' -app ' + quote(ini) + ' "$@"\n', { mode: 0o755 });
  }
  return { executablePath: wrapper, timeout: 30000 };
}

module.exports = { firefoxLaunchOptions };
