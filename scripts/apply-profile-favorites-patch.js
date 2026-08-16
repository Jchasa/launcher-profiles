const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function normalize(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function edit(file, marker, replacement) {
  const filePath = path.join(root, file);
  let text = normalize(fs.readFileSync(filePath, 'utf8'));
  marker = normalize(marker);
  replacement = normalize(replacement);

  if (text.includes(replacement)) return;
  if (!text.includes(marker)) {
    throw new Error(`Profile favorites marker not found in ${file}: ${marker}`);
  }

  text = text.replace(marker, replacement);
  fs.writeFileSync(filePath, text.replace(/\n/g, '\r\n'));
}

// Import the profile-aware playlist projection into the backend request handlers.
edit(
  'src/back/responses.ts',
  `  filterPlaylists,\n  getPlaylistGame,`,
  `  filterPlaylists,\n  getProfileAwarePlaylists,\n  getPlaylistGame,`
);

// The normal Flashpoint Favorites playlist remains the UI-facing playlist, but its
// contents are projected from the active profile instead of being persisted as a
// shared global favorite list.
edit(
  'src/back/playlist.ts',
  `export function findPlaylist(state: BackState, playlistId: string): Playlist {`,
  `export function getProfileAwarePlaylists(state: BackState, extreme: boolean): Playlist[] {\n  const playlists = filterPlaylists(state.playlists, extreme);\n  const favorites = playlists.find(p => p.title.includes('Favorites'));\n\n  if (!favorites) return playlists;\n\n  if (!state.profileManager.isFavoritesInitialized()) {\n    state.profileManager.initializeFavorites(favorites.games.map(game => game.gameId));\n  }\n\n  const favoriteIds = state.profileManager.activeFavoriteIds();\n  const existingGames = new Map(favorites.games.map(game => [game.gameId, game]));\n  const projectedFavorites: Playlist = {\n    ...favorites,\n    games: favoriteIds.map(gameId => existingGames.get(gameId) || ({ gameId, notes: '' }))\n  };\n\n  return playlists.map(playlist => playlist.id === favorites.id ? projectedFavorites : playlist);\n}\n\nexport function findPlaylist(state: BackState, playlistId: string): Playlist {`
);

edit(
  'src/back/playlist.ts',
  `export async function addPlaylistGame(state: BackState, playlistId: string, gameId: string): Promise<void> {\n  const playlist = state.playlists.find(p => p.id === playlistId);`,
  `export async function addPlaylistGame(state: BackState, playlistId: string, gameId: string): Promise<void> {\n  const playlist = state.playlists.find(p => p.id === playlistId);\n  if (playlist && playlist.title.includes('Favorites')) {\n    state.profileManager.setFavorite(gameId, true);\n    state.socketServer.broadcast(BackOut.PLAYLISTS_CHANGE, getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme));\n    return;\n  }`
);

edit(
  'src/back/playlist.ts',
  `export async function deletePlaylistGame(state: BackState, playlistId: string, gameId: string): Promise<PlaylistGame> {\n  const playlist = state.playlists.find(p => p.id === playlistId);`,
  `export async function deletePlaylistGame(state: BackState, playlistId: string, gameId: string): Promise<PlaylistGame> {\n  const playlist = state.playlists.find(p => p.id === playlistId);\n  if (playlist && playlist.title.includes('Favorites')) {\n    const existing = playlist.games.find(game => game.gameId === gameId);\n    if (!existing) throw 'Game does not exist in playlist';\n    state.profileManager.setFavorite(gameId, false);\n    state.socketServer.broadcast(BackOut.PLAYLISTS_CHANGE, getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme));\n    return existing;\n  }`
);

edit(
  'src/back/playlist.ts',
  `  state.socketServer.broadcast(BackOut.PLAYLISTS_CHANGE, filterPlaylists(state.playlists, state.preferences.browsePageShowExtreme));`,
  `  state.socketServer.broadcast(BackOut.PLAYLISTS_CHANGE, getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme));`
);

// GET_PLAYLISTS must return the profile projection, otherwise the renderer will
// immediately replace the profile-aware Favorites list with the global list.
edit(
  'src/back/responses.ts',
  `  state.socketServer.register(BackIn.GET_PLAYLISTS, async () => {\n    return filterPlaylists(state.playlists, state.preferences.browsePageShowExtreme);\n  });`,
  `  state.socketServer.register(BackIn.GET_PLAYLISTS, async () => {\n    return getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme);\n  });`
);

console.log('Profile-specific Favorites patch applied.');
