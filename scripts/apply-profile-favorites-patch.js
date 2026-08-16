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

// Keep the normal Flashpoint Favorites playlist as the UI-facing playlist, but
// project its contents from the active profile rather than changing the shared
// Favorites JSON on disk.
edit(
  'src/back/playlist.ts',
  `export function findPlaylist(state: BackState, playlistId: string): Playlist {`,
  `export function getProfileAwarePlaylists(state: BackState, extreme: boolean): Playlist[] {\n  const playlists = filterPlaylists(state.playlists, extreme);\n  const favorites = playlists.find(p => p.title.includes('Favorites'));\n\n  if (!favorites) return playlists;\n\n  if (!state.profileManager.isFavoritesInitialized()) {\n    state.profileManager.initializeFavorites(favorites.games.map(game => game.gameId));\n  }\n\n  const favoriteIds = state.profileManager.activeFavoriteIds();\n  const existingGames = new Map(favorites.games.map(game => [game.gameId, game]));\n  const projectedFavorites: Playlist = {\n    ...favorites,\n    games: favoriteIds.map(gameId => existingGames.get(gameId) || ({ gameId, notes: '' }))\n  };\n\n  return playlists.map(playlist => playlist.id === favorites.id ? projectedFavorites : playlist);\n}\n\nexport function findPlaylist(state: BackState, playlistId: string): Playlist {`
);

// Adding/removing a game from Favorites changes only the active profile.
edit(
  'src/back/playlist.ts',
  `  if (playlist) {\n    const game = playlist.games.find(g => g.gameId === gameId);\n    if (game) {\n      throw 'Game already exists in playlist';\n    } else {`,
  `  if (playlist) {\n    if (playlist.title.includes('Favorites')) {\n      if (state.profileManager.isFavorite(gameId)) {\n        throw 'Game already exists in playlist';\n      }\n      state.profileManager.setFavorite(gameId, true);\n      state.socketServer.broadcast(BackOut.PLAYLISTS_CHANGE, getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme));\n      return;\n    }\n    const game = playlist.games.find(g => g.gameId === gameId);\n    if (game) {\n      throw 'Game already exists in playlist';\n    } else {`
);

edit(
  'src/back/playlist.ts',
  `  if (playlist) {\n    const gameIdx = playlist.games.findIndex(g => g.gameId === gameId);\n    if (gameIdx !== -1) {\n      const oldPlaylist = deepCopy(playlist);\n      const removedGame = playlist.games.splice(gameIdx, 1);`,
  `  if (playlist) {\n    if (playlist.title.includes('Favorites')) {\n      if (!state.profileManager.isFavorite(gameId)) {\n        throw 'Game does not exist in playlist';\n      }\n      state.profileManager.setFavorite(gameId, false);\n      const existing = playlist.games.find(game => game.gameId === gameId);\n      state.socketServer.broadcast(BackOut.PLAYLISTS_CHANGE, getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme));\n      return existing || { gameId, notes: '' };\n    }\n    const gameIdx = playlist.games.findIndex(g => g.gameId === gameId);\n    if (gameIdx !== -1) {\n      const oldPlaylist = deepCopy(playlist);\n      const removedGame = playlist.games.splice(gameIdx, 1);`
);

// All playlist refreshes must preserve the active profile's Favorites projection.
edit(
  'src/back/playlist.ts',
  `  state.socketServer.broadcast(BackOut.PLAYLISTS_CHANGE, filterPlaylists(state.playlists, state.preferences.browsePageShowExtreme));`,
  `  state.socketServer.broadcast(BackOut.PLAYLISTS_CHANGE, getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme));`
);

// GET_PLAYLISTS must return the projected Favorites playlist, otherwise the
// renderer immediately replaces it with the shared global playlist.
edit(
  'src/back/responses.ts',
  `  state.socketServer.register(BackIn.GET_PLAYLISTS, async () => {\n    return filterPlaylists(state.playlists, state.preferences.browsePageShowExtreme);\n  });`,
  `  state.socketServer.register(BackIn.GET_PLAYLISTS, async () => {\n    return getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme);\n  });`
);

// Direct playlist requests also need the projection.
edit(
  'src/back/responses.ts',
  `  state.socketServer.register(BackIn.GET_PLAYLIST, async (event, playlistId) => {\n    return state.playlists.find(p => p.id === playlistId);\n  });`,
  `  state.socketServer.register(BackIn.GET_PLAYLIST, async (event, playlistId) => {\n    return getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme).find(p => p.id === playlistId);\n  });`
);

// A Favorites game lookup must use the projected list as well.
edit(
  'src/back/responses.ts',
  `  state.socketServer.register(BackIn.GET_PLAYLIST_GAME, async (event, playlistId, gameId) => {\n    return getPlaylistGame(state, playlistId, gameId);\n  });`,
  `  state.socketServer.register(BackIn.GET_PLAYLIST_GAME, async (event, playlistId, gameId) => {\n    const playlist = getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme).find(p => p.id === playlistId);\n    if (!playlist) return null;\n    return playlist.games.find(game => game.gameId === gameId) || null;\n  });`
);

console.log('Profile-specific Favorites patch applied.');
