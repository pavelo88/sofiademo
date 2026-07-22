const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const bad = /[ÃÂâð�]/;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|jsx|json|md|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const candidates = walk('src');
let changed = 0;
for (const file of candidates) {
  const original = fs.readFileSync(file, 'utf8');
  if (!bad.test(original)) continue;

  const sep = original.includes('\r\n') ? '\r\n' : '\n';
  const fixed = original
    .split(/\r?\n/)
    .map((line) => {
      if (!bad.test(line)) return line;
      let out = line;
      for (let i = 0; i < 3 && bad.test(out); i += 1) {
        const next = iconv.decode(iconv.encode(out, 'win1252'), 'utf8');
        if (next === out) break;
        out = next;
      }
      return out;
    })
    .join(sep);

  if (fixed !== original) {
    fs.writeFileSync(file, fixed, 'utf8');
    changed += 1;
    console.log('fixed', file);
  }
}
console.log('changed', changed);
