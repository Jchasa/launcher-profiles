const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'src/renderer/components/Header.tsx');

function normalize(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function edit(marker, replacement) {
  let text = normalize(fs.readFileSync(file, 'utf8'));
  marker = normalize(marker);
  replacement = normalize(replacement);
  if (text.includes(replacement)) return;
  if (!text.includes(marker)) {
    throw new Error(`Profile indicator marker not found in Header.tsx: ${marker}`);
  }
  text = text.replace(marker, replacement);
  fs.writeFileSync(file, text.replace(/\n/g, '\r\n'));
}

edit(
  "import { WithConfirmDialogProps } from '@renderer/containers/withConfirmDialog';",
  "import { WithConfirmDialogProps } from '@renderer/containers/withConfirmDialog';\nimport { ProfileIndicator } from './ProfileIndicator';"
);

edit(
  "        {/* Right-most portion */}\n        <div className='header__wrap header__right'>",
  "        {/* Right-most portion */}\n        <ProfileIndicator />\n        <div className='header__wrap header__right'>"
);

console.log('Flashpoint active profile indicator patch applied.');
