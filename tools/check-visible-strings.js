#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const JS = path.join(ROOT, 'EchoClassic/HTML/echoclassic/html/js');
const BASELINE = path.join(ROOT, 'qa/visible-string-baseline.json');
const strings = fs.readFileSync(path.join(ROOT, 'EchoClassic/strings.txt'), 'utf8');
const english = new Set();
for (const line of strings.split('\n')) {
  const match = line.match(/^\s+EN\s+(.*)$/);
  if (match) english.add(match[1].trim());
}

const allowed = new Set([
  'Echo Classic', 'LMS', 'API', 'OSF', 'CSF', 'DSP', 'FIR', 'Q', 'Hz', 'kHz',
  'dB', 'ms', 'FLAC', 'MP3', 'AAC', '•••', '×', '✓', '!', '›', '‹ Player'
]);
function clean(text) {
  return text.replace(/\{\{[\s\S]*?\}\}/g, ' ').replace(/\s+/g, ' ').trim();
}
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? files(file) : (entry.name.endsWith('.js') ? [file] : []);
  });
}
function accepted(text) {
  if (!text || allowed.has(text) || english.has(text)) return true;
  if (!/[A-Za-z]/.test(text)) return true;
  if (/^(?:LMS|API|DSP|OSF|CSF|FIR)\b/.test(text) && text.split(/\s+/).length <= 2) return true;
  return false;
}

const findings = [];
for (const file of files(JS)) {
  const source = fs.readFileSync(file, 'utf8');
  /* Only Vue template literals are rendered as markup. Scanning the whole JS
     file mistakes comparison operators and regular expressions for HTML. */
  for (const templateMatch of source.matchAll(/template\s*:\s*`([\s\S]*?)`/g)) {
    const firstLine = source.slice(0, templateMatch.index).split('\n').length;
    templateMatch[1].split('\n').forEach((line, offset) => {
      for (const match of line.matchAll(/>([^<>]*[A-Za-z][^<>]*)</g)) {
        const text = clean(match[1]);
        if (!accepted(text)) findings.push({ file, line: firstLine + offset, text });
      }
      for (const match of line.matchAll(/\s(?:title|placeholder|aria-label|aria-description)="([^"]+)"/g)) {
        const text = clean(match[1]);
        if (!accepted(text)) findings.push({ file, line: firstLine + offset, text });
      }
    });
  }
}

const normalized = Array.from(new Set(findings.map(finding =>
  path.relative(ROOT, finding.file) + ' :: ' + finding.text
))).sort();
if (process.argv.includes('--update-baseline')) {
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(BASELINE, JSON.stringify(normalized, null, 2) + '\n');
  console.log('  wrote visible-string baseline with ' + normalized.length + ' existing phrases');
  process.exit(0);
}
const baseline = new Set(fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : []);
const introduced = normalized.filter(item => !baseline.has(item));
if (introduced.length) {
  console.error('  FALHA  newly introduced visible English text is missing from strings.txt:');
  for (const item of introduced) {
    console.error('    ' + item);
  }
  process.exit(1);
}
console.log('  ok    no new untranslated visible phrases (' + baseline.size + ' older phrases baselined)');
