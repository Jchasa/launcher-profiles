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
    throw new Error(`Profile playlists marker not found in ${file}: ${marker}`);
  }

  text = text.replace(marker, replacement);
  fs.writeFileSync(filePath, text.replace(/\n/g, '\r\n'));
}

edit('src/back/types.ts', `import { Downloader } from './Downloader';`, `import { Downloader } from './Downloader';\nimport { PlaylistOwnershipManager } from './PlaylistOwnershipManager';`);
edit('src/back/types.ts', `  playlists: flashpoint.Playlist[];`, `  playlists: flashpoint.Playlist[];\n  playlistOwnershipManager: PlaylistOwnershipManager;`);

edit('src/back/index.ts', `import { PlaylistFile } from './PlaylistFile';`, `import { PlaylistFile } from './PlaylistFile';\nimport { PlaylistOwnershipManager } from './PlaylistOwnershipManager';`);
edit('src/back/index.ts', `  playlists: [],\n  execMappings: [],`, `  playlists: [],\n  playlistOwnershipManager: createErrorProxy('playlistOwnershipManager'),\n  execMappings: [],`);
edit('src/back/index.ts', `  state.configFolder = content.configFolder;`, `  state.configFolder = content.configFolder;\n  state.playlistOwnershipManager = new PlaylistOwnershipManager(state.configFolder);`);

edit(
  'src/back/index.ts',
  `  console.log('Back - Parsed Playlists');`,
  `  state.playlistOwnershipManager.initializeExisting(state.playlists);\n\n  const playlistWatcher = new FolderWatcher();\n  let playlistWatcherReady = false;\n  playlistWatcher.on('ready', () => {\n    playlistWatcherReady = true;\n  });\n  playlistWatcher.on('add', async (filename: string, offsetPath: string) => {\n    if (!playlistWatcherReady || !filename.endsWith('.json')) return;\n    const filePath = path.join(playlistDir, offsetPath, filename);\n    try {\n      const playlist = await PlaylistFile.readFile(filePath);\n      if (state.playlists.some(p => p.id === playlist.id || p.filePath === filePath)) return;\n      state.playlistOwnershipManager.assignToProfile(playlist, state.profileManager.active());\n      state.playlists.push(playlist);\n      state.socketServer.broadcast(BackOut.PLAYLISTS_CHANGE, getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme));\n    } catch (err) {\n      log.error('Launcher', `Failed to load newly detected Playlist ${filename}, ERROR:\\n${err}`);\n    }\n  });\n  playlistWatcher.on('remove', (filename: string) => {\n    if (!filename.endsWith('.json')) return;\n    const removed = state.playlists.find(p => p.filePath && path.basename(p.filePath) === filename);\n    if (removed) {\n      state.playlists = state.playlists.filter(p => p.id !== removed.id);\n      state.playlistOwnershipManager.remove(removed.id);\n      state.socketServer.broadcast(BackOut.PLAYLISTS_CHANGE, getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme));\n    }\n  });\n  playlistWatcher.on('error', (error: Error) => log.error('Launcher', `Playlist watcher error: ${error}`));\n  playlistWatcher.watch(playlistDir);\n\n  console.log('Back - Parsed Playlists');`
);

edit(
  'src/back/playlist.ts',
  `  return playlists.map(playlist => playlist.id === favorites.id ? projectedFavorites : playlist);`,
  `  return playlists\n    .filter(playlist => state.playlistOwnershipManager.visibleToProfile(playlist, state.profileManager.active().id))\n    .map(playlist => playlist.id === favorites.id ? projectedFavorites : playlist);`
);
edit(
  'src/back/playlist.ts',
  `  if (!favorites) return playlists;`,
  `  if (!favorites) {\n    return playlists.filter(playlist => state.playlistOwnershipManager.visibleToProfile(playlist, state.profileManager.active().id));\n  }`
);
edit(
  'src/back/playlist.ts',
  `  const existingIdx = state.playlists.findIndex(p => p.id === playlist.id);\n  if (existingIdx !== -1) {`,
  `  const existingIdx = state.playlists.findIndex(p => p.id === playlist.id);\n  if (existingIdx === -1 && !playlist.title.includes('Favorites')) {\n    state.playlistOwnershipManager.assignToProfile(playlist, state.profileManager.active());\n  }\n  if (existingIdx !== -1) {`
);
edit(
  'src/back/playlist.ts',
  `    state.playlists.splice(playlistIdx, 1);\n    return playlist;`,
  `    state.playlists.splice(playlistIdx, 1);\n    state.playlistOwnershipManager.remove(playlist.id);\n    return playlist;`
);

edit(
  'src/back/responses.ts',
  `  state.socketServer.register(BackIn.GET_PLAYLIST, async (event, playlistId) => {\n    return state.playlists.find(p => p.id === playlistId);\n  });`,
  `  state.socketServer.register(BackIn.GET_PLAYLIST, async (event, playlistId) => {\n    return getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme).find(p => p.id === playlistId);\n  });`
);
edit(
  'src/back/responses.ts',
  `  state.socketServer.register(BackIn.GET_PLAYLISTS, async () => {\n    return filterPlaylists(state.playlists, state.preferences.browsePageShowExtreme);\n  });`,
  `  state.socketServer.register(BackIn.GET_PLAYLISTS, async () => {\n    return getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme);\n  });`
);
edit(
  'src/back/responses.ts',
  `  state.socketServer.register(BackIn.SWITCH_PROFILE, (event, profileId) => state.profileManager.switchTo(profileId));`,
  `  state.socketServer.register(BackIn.SWITCH_PROFILE, (event, profileId) => {\n    const profile = state.profileManager.switchTo(profileId);\n    state.socketServer.broadcast(BackOut.PLAYLISTS_CHANGE, getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme));\n    return profile;\n  });`
);

console.log('Profile-owned Playlists patch applied.');
