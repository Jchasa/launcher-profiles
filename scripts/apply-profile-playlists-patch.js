const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

function normalize(text) { return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'); }

function edit(file, marker, replacement) {
  const filePath = path.join(root, file);
  let text = normalize(fs.readFileSync(filePath, 'utf8'));
  marker = normalize(marker);
  replacement = normalize(replacement);
  if (text.includes(replacement)) return;
  if (!text.includes(marker)) throw new Error(`Profile playlists marker not found in ${file}: ${marker}`);
  text = text.replace(marker, replacement);
  fs.writeFileSync(filePath, text.replace(/\n/g, '\r\n'));
}

edit('src/back/types.ts', `import { Downloader } from './Downloader';`, `import { Downloader } from './Downloader';\nimport { PlaylistOwnershipManager } from './PlaylistOwnershipManager';`);
edit('src/back/types.ts', `  playlists: flashpoint.Playlist[];`, `  playlists: flashpoint.Playlist[];\n  playlistOwnershipManager: PlaylistOwnershipManager;`);
edit('src/back/index.ts', `import { PlaylistFile } from './PlaylistFile';`, `import { PlaylistFile } from './PlaylistFile';\nimport { PlaylistOwnershipManager } from './PlaylistOwnershipManager';\nimport { getProfileAwarePlaylists } from './playlist';`);
edit('src/back/index.ts', `  playlists: [],\n  execMappings: [],`, `  playlists: [],\n  playlistOwnershipManager: createErrorProxy('playlistOwnershipManager'),\n  execMappings: [],`);
edit('src/back/index.ts', `  state.configFolder = content.configFolder;`, `  state.configFolder = content.configFolder;\n  state.playlistOwnershipManager = new PlaylistOwnershipManager(state.configFolder);`);

const watcherReplacement = [
  `  state.playlistOwnershipManager.initializeExisting(state.playlists);`,
  ``,
  `  const playlistWatcher = new FolderWatcher();`,
  `  let playlistWatcherReady = false;`,
  `  playlistWatcher.on('ready', () => { playlistWatcherReady = true; });`,
  `  playlistWatcher.on('add', async (filename: string, offsetPath: string) => {`,
  `    if (!playlistWatcherReady || !filename.endsWith('.json')) return;`,
  `    const filePath = path.join(playlistDir, offsetPath, filename);`,
  `    try {`,
  `      const playlist = await PlaylistFile.readFile(filePath);`,
  `      if (state.playlists.some(p => p.id === playlist.id || p.filePath === filePath)) return;`,
  `      state.playlistOwnershipManager.assignToProfile(playlist, state.profileManager.active());`,
  `      state.playlists.push(playlist);`,
  `      state.socketServer.broadcast(BackOut.PLAYLISTS_CHANGE, getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme));`,
  `    } catch (err) {`,
  `      log.error('Launcher', 'Failed to load newly detected Playlist ' + filename + ', ERROR:\\n' + err);`,
  `    }`,
  `  });`,
  `  playlistWatcher.on('remove', (filename: string) => {`,
  `    if (!filename.endsWith('.json')) return;`,
  `    const removed = state.playlists.find(p => p.filePath && path.basename(p.filePath) === filename);`,
  `    if (removed) {`,
  `      state.playlists = state.playlists.filter(p => p.id !== removed.id);`,
  `      state.playlistOwnershipManager.remove(removed.id);`,
  `      state.socketServer.broadcast(BackOut.PLAYLISTS_CHANGE, getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme));`,
  `    }`,
  `  });`,
  `  playlistWatcher.on('error', (error: Error) => log.error('Launcher', 'Playlist watcher error: ' + error));`,
  `  playlistWatcher.watch(playlistDir);`,
  ``,
  `  console.log('Back - Parsed Playlists');`
].join('\n');

edit('src/back/index.ts', `  console.log('Back - Parsed Playlists');`, watcherReplacement);
edit('src/back/playlist.ts', `  return playlists.map(playlist => playlist.id === favorites.id ? projectedFavorites : playlist);`, `  return playlists\n    .filter(playlist => state.playlistOwnershipManager.visibleToProfile(playlist, state.profileManager.active().id))\n    .map(playlist => playlist.id === favorites.id ? projectedFavorites : playlist);`);
edit('src/back/playlist.ts', `  if (!favorites) return playlists;`, `  if (!favorites) {\n    return playlists.filter(playlist => state.playlistOwnershipManager.visibleToProfile(playlist, state.profileManager.active().id));\n  }`);
edit('src/back/playlist.ts', `  const existingIdx = state.playlists.findIndex(p => p.id === playlist.id);\n  if (existingIdx !== -1) {`, `  const existingIdx = state.playlists.findIndex(p => p.id === playlist.id);\n  if (existingIdx === -1 && !playlist.title.includes('Favorites')) {\n    state.playlistOwnershipManager.assignToProfile(playlist, state.profileManager.active());\n  }\n  if (existingIdx !== -1) {`);
edit('src/back/playlist.ts', `    state.playlists.splice(playlistIdx, 1);\n    return playlist;`, `    state.playlists.splice(playlistIdx, 1);\n    state.playlistOwnershipManager.remove(playlist.id);\n    return playlist;`);
edit('src/back/responses.ts', `  state.socketServer.register(BackIn.GET_PLAYLIST, async (event, playlistId) => {\n    return state.playlists.find(p => p.id === playlistId);\n  });`, `  state.socketServer.register(BackIn.GET_PLAYLIST, async (event, playlistId) => {\n    return getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme).find(p => p.id === playlistId);\n  });`);
edit('src/back/responses.ts', `  state.socketServer.register(BackIn.GET_PLAYLISTS, async () => {\n    return filterPlaylists(state.playlists, state.preferences.browsePageShowExtreme);\n  });`, `  state.socketServer.register(BackIn.GET_PLAYLISTS, async () => {\n    return getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme);\n  });`);
edit('src/back/responses.ts', `  state.socketServer.register(BackIn.SWITCH_PROFILE, (event, profileId) => state.profileManager.switchTo(profileId));`, `  state.socketServer.register(BackIn.SWITCH_PROFILE, (event, profileId) => {\n    const profile = state.profileManager.switchTo(profileId);\n    state.socketServer.broadcast(BackOut.PLAYLISTS_CHANGE, getProfileAwarePlaylists(state, state.preferences.browsePageShowExtreme));\n    return profile;\n  });`);
console.log('Profile-owned Playlists patch applied.');
