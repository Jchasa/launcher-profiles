const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const filePath = path.join(root, 'src/back/ProfileManager.ts');

function normalize(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

let text = normalize(fs.readFileSync(filePath, 'utf8'));

// The profile implementation is now committed to the branch. This build-time
// patcher only supplies the small compatibility method required by the
// profile-aware Favorites patch, and is deliberately idempotent.
if (!text.includes('  isFavorite(gameId: string): boolean {')) {
  const marker = '  setFavorite(gameId: string, favorite: boolean): FlashpointProfile {';
  if (!text.includes(marker)) {
    throw new Error('ProfileManager is missing the expected setFavorite method.');
  }

  const replacement = `  isFavorite(gameId: string): boolean {
    return this.store.profiles.find(p => p.id === this.store.activeProfileId)?.favorites.includes(gameId) === true;
  }

${marker}`;
  text = text.replace(marker, replacement);
  fs.writeFileSync(filePath, text.replace(/\n/g, '\r\n'));
}

console.log('Profile build compatibility patch applied.');
