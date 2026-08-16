const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function normalize(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function edit(file, marker, replacement) {
  const filePath = path.join(root, file);
  let text = normalize(fs.readFileSync(filePath, 'utf8'));
  const normalizedMarker = normalize(marker);
  const normalizedReplacement = normalize(replacement);

  if (text.includes(normalizedReplacement)) return;
  if (!text.includes(normalizedMarker)) {
    throw new Error(`Profiles patch marker not found in ${file}: ${marker}`);
  }

  text = text.replace(normalizedMarker, normalizedReplacement);
  fs.writeFileSync(filePath, text.replace(/\n/g, '\r\n'));
}

// Shared request API.
edit(
  'src/shared/back/types.ts',
  '  // Tests\n  TEST_RECONNECTIONS,',
  `  // Profiles\n  GET_PROFILES,\n  CREATE_PROFILE,\n  SWITCH_PROFILE,\n  RENAME_PROFILE,\n  DELETE_PROFILE,\n  SET_PROFILE_FAVORITE,\n  RECORD_PROFILE_PLAY,\n\n  // Tests\n  TEST_RECONNECTIONS,`
);

edit(
  'src/shared/back/types.ts',
  '  [BackIn.KEEP_ALIVE]: () => void;',
  `  [BackIn.GET_PROFILES]: () => { profiles: import('../profiles/types').FlashpointProfile[]; activeProfileId: string };\n  [BackIn.CREATE_PROFILE]: (name: string) => import('../profiles/types').FlashpointProfile;\n  [BackIn.SWITCH_PROFILE]: (profileId: string) => import('../profiles/types').FlashpointProfile;\n  [BackIn.RENAME_PROFILE]: (profileId: string, name: string) => import('../profiles/types').FlashpointProfile;\n  [BackIn.DELETE_PROFILE]: (profileId: string) => void;\n  [BackIn.SET_PROFILE_FAVORITE]: (gameId: string, favorite: boolean) => import('../profiles/types').FlashpointProfile;\n  [BackIn.RECORD_PROFILE_PLAY]: (gameId: string) => import('../profiles/types').FlashpointProfile;\n  [BackIn.KEEP_ALIVE]: () => void;`
);

// Backend state.
edit(
  'src/back/types.ts',
  "import { Downloader } from './Downloader';",
  "import { Downloader } from './Downloader';\nimport { ProfileManager } from './ProfileManager';"
);
edit(
  'src/back/types.ts',
  '  downloader: Downloader;\n',
  '  downloader: Downloader;\n  profileManager: ProfileManager;\n'
);

// Backend initialization.
edit(
  'src/back/index.ts',
  "import { Downloader } from './Downloader';",
  "import { Downloader } from './Downloader';\nimport { ProfileManager } from './ProfileManager';"
);
edit(
  'src/back/index.ts',
  "  downloader: createErrorProxy('downloader'),",
  "  downloader: createErrorProxy('downloader'),\n  profileManager: createErrorProxy('profileManager'),"
);
edit(
  'src/back/index.ts',
  '  state.configFolder = content.configFolder;\n',
  '  state.configFolder = content.configFolder;\n  state.profileManager = new ProfileManager(state.configFolder);\n'
);

// Backend request handlers.
edit(
  'src/back/responses.ts',
  "  state.socketServer.register(BackIn.KEEP_ALIVE, () => {});",
  `  state.socketServer.register(BackIn.GET_PROFILES, () => ({\n    profiles: state.profileManager.list(),\n    activeProfileId: state.profileManager.active().id\n  }));\n\n  state.socketServer.register(BackIn.CREATE_PROFILE, (event, name) => state.profileManager.create(name));\n  state.socketServer.register(BackIn.SWITCH_PROFILE, (event, profileId) => state.profileManager.switchTo(profileId));\n  state.socketServer.register(BackIn.RENAME_PROFILE, (event, profileId, name) => state.profileManager.rename(profileId, name));\n  state.socketServer.register(BackIn.DELETE_PROFILE, (event, profileId) => state.profileManager.remove(profileId));\n  state.socketServer.register(BackIn.SET_PROFILE_FAVORITE, (event, gameId, favorite) => state.profileManager.setFavorite(gameId, favorite));\n  state.socketServer.register(BackIn.RECORD_PROFILE_PLAY, (event, gameId) => state.profileManager.recordPlay(gameId));\n\n  state.socketServer.register(BackIn.KEEP_ALIVE, () => {});`
);

// Navigation path.
edit(
  'src/shared/Paths.ts',
  "  DOWNLOADS  = '/downloads',",
  "  DOWNLOADS  = '/downloads',\n  PROFILES   = '/profiles',"
);

// Renderer route.
edit(
  'src/renderer/router.tsx',
  "import { DownloadsPage } from './components/pages/Downloads';",
  "import { DownloadsPage } from './components/pages/Downloads';\nimport { ProfilesPage } from './components/pages/ProfilesPage';"
);
edit(
  'src/renderer/router.tsx',
  `        <PropsRoute\n          path={Paths.DOWNLOADS}\n          component={DownloadsPage} />`,
  `        <PropsRoute\n          path={Paths.DOWNLOADS}\n          component={DownloadsPage} />\n        <PropsRoute\n          path={Paths.PROFILES}\n          component={ProfilesPage} />`
);

// Header entry point makes the feature discoverable and testable.
edit(
  'src/renderer/components/Header.tsx',
  `            <MenuItem\n              id={'header__config'}\n              title={strings.config}\n              link={Paths.CONFIG} />`,
  `            <MenuItem\n              id={'header__config'}\n              title={strings.config}\n              link={Paths.CONFIG} />\n            <MenuItem\n              id={'header__profiles'}\n              title={'Profiles'}\n              link={Paths.PROFILES} />`
);

// Profile store migration: preserve the existing MVP data while adding an explicit
// Favorites migration flag so an existing global Favorites playlist is imported once.
edit(
  'src/shared/profiles/types.ts',
  `export type ProfileStore = {\n  version: 1;\n  activeProfileId: string;\n  profiles: FlashpointProfile[];\n};`,
  `export type ProfileStore = {\n  version: 2;\n  activeProfileId: string;\n  favoritesInitialized: boolean;\n  profiles: FlashpointProfile[];\n};`
);

edit(
  'src/back/ProfileManager.ts',
  `const STORE_FILENAME = 'profiles.json';\nconst STORE_VERSION = 1;`,
  `const STORE_FILENAME = 'profiles.json';\nconst STORE_VERSION = 2;`
);

edit(
  'src/back/ProfileManager.ts',
  `  private load(): ProfileStore {\n    try {\n      const data = fs.readJsonSync(this.filePath) as Partial<ProfileStore>;\n      if (data.version === STORE_VERSION && Array.isArray(data.profiles) && data.profiles.length > 0) {\n        const activeProfileId = data.profiles.some(p => p.id === data.activeProfileId)\n          ? data.activeProfileId as string\n          : data.profiles[0].id;\n        return {\n          version: STORE_VERSION,\n          activeProfileId,\n          profiles: data.profiles\n        };\n      }\n    } catch {\n      // First run or an unreadable profile store.\n    }\n\n    const profile = createProfile('Default');\n    const store: ProfileStore = {\n      version: STORE_VERSION,\n      activeProfileId: profile.id,\n      profiles: [profile]\n    };\n    this.store = store;\n    this.save();\n    return store;\n  }`,
  `  private load(): ProfileStore {\n    try {\n      const data = fs.readJsonSync(this.filePath) as Partial<ProfileStore> & { version?: number };\n      if (Array.isArray(data.profiles) && data.profiles.length > 0) {\n        const activeProfileId = data.profiles.some(p => p.id === data.activeProfileId)\n          ? data.activeProfileId as string\n          : data.profiles[0].id;\n\n        if (data.version === STORE_VERSION) {\n          return {\n            version: STORE_VERSION,\n            activeProfileId,\n            favoritesInitialized: data.favoritesInitialized === true,\n            profiles: data.profiles\n          };\n        }\n\n        // Migrate the MVP profile store. Favorites will be imported from the\n        // existing Flashpoint Favorites playlist on the first playlist sync.\n        if (data.version === 1) {\n          const store: ProfileStore = {\n            version: STORE_VERSION,\n            activeProfileId,\n            favoritesInitialized: false,\n            profiles: data.profiles\n          };\n          this.store = store;\n          this.save();\n          return store;\n        }\n      }\n    } catch {\n      // First run or an unreadable profile store.\n    }\n\n    const profile = createProfile('Default');\n    const store: ProfileStore = {\n      version: STORE_VERSION,\n      activeProfileId: profile.id,\n      favoritesInitialized: false,\n      profiles: [profile]\n    };\n    this.store = store;\n    this.save();\n    return store;\n  }`
);

edit(
  'src/back/ProfileManager.ts',
  `  setFavorite(gameId: string, favorite: boolean): FlashpointProfile {`,
  `  activeFavoriteIds(): string[] {\n    return [...this.active().favorites];\n  }\n\n  initializeFavorites(gameIds: string[]): void {\n    if (this.store.favoritesInitialized) return;\n\n    const profile = this.store.profiles.find(p => p.id === this.store.activeProfileId);\n    if (!profile) throw new Error('Active profile does not exist');\n\n    profile.favorites = [...new Set(gameIds)];\n    this.store.favoritesInitialized = true;\n    this.save();\n  }\n\n  setFavorite(gameId: string, favorite: boolean): FlashpointProfile {`
);

// Keep the normal Flashpoint Favorites playlist as the visible projection of the
// active profile. This preserves the existing UI while storing the real ownership
// of each favorite in profiles.json.
edit(
  'src/back/responses.ts',
  `export function registerRequestCallbacks(state: BackState, init: () => Promise<void>): void {`,
  `async function syncProfileFavorites(state: BackState): Promise<void> {\n  const playlist = state.playlists.find(p => p.title.includes('Favorites'));\n  if (!playlist) return;\n\n  if (!state.profileManager.isFavoritesInitialized()) {\n    state.profileManager.initializeFavorites(playlist.games.map(game => game.gameId));\n  }\n\n  const favoriteIds = state.profileManager.activeFavoriteIds();\n  const favoriteSet = new Set(favoriteIds);\n  const existingGames = new Map(playlist.games.map(game => [game.gameId, game]));\n  const oldPlaylist = deepCopy(playlist);\n\n  playlist.games = favoriteIds.map(gameId => existingGames.get(gameId) || ({ gameId, notes: '' }));\n\n  if (JSON.stringify(oldPlaylist.games) !== JSON.stringify(playlist.games)) {\n    await updatePlaylist(state, oldPlaylist, playlist);\n  }\n}\n\nexport function registerRequestCallbacks(state: BackState, init: () => Promise<void>): void {`
);

edit(
  'src/back/responses.ts',
  `  state.socketServer.register(BackIn.GET_PROFILES, () => ({\n    profiles: state.profileManager.list(),\n    activeProfileId: state.profileManager.active().id\n  }));`,
  `  state.socketServer.register(BackIn.GET_PROFILES, async () => ({\n    profiles: state.profileManager.list(),\n    activeProfileId: state.profileManager.active().id\n  }));`
);

edit(
  'src/back/responses.ts',
  `  state.socketServer.register(BackIn.SWITCH_PROFILE, (event, profileId) => state.profileManager.switchTo(profileId));`,
  `  state.socketServer.register(BackIn.SWITCH_PROFILE, async (event, profileId) => {\n    const profile = state.profileManager.switchTo(profileId);\n    await syncProfileFavorites(state);\n    return profile;\n  });`
);

edit(
  'src/back/responses.ts',
  `  state.socketServer.register(BackIn.GET_PLAYLISTS, async () => {\n    return filterPlaylists(state.playlists, state.preferences.browsePageShowExtreme);\n  });`,
  `  state.socketServer.register(BackIn.GET_PLAYLISTS, async () => {\n    await syncProfileFavorites(state);\n    return filterPlaylists(state.playlists, state.preferences.browsePageShowExtreme);\n  });`
);

edit(
  'src/back/responses.ts',
  `  state.socketServer.register(BackIn.SET_PROFILE_FAVORITE, (event, gameId, favorite) => state.profileManager.setFavorite(gameId, favorite));`,
  `  state.socketServer.register(BackIn.SET_PROFILE_FAVORITE, async (event, gameId, favorite) => {\n    const profile = state.profileManager.setFavorite(gameId, favorite);\n    await syncProfileFavorites(state);\n    return profile;\n  });`
);

// Ensure the manager can report migration state without exposing its internal store.
edit(
  'src/back/ProfileManager.ts',
  `  activeFavoriteIds(): string[] {`,
  `  isFavoritesInitialized(): boolean {\n    return this.store.favoritesInitialized;\n  }\n\n  activeFavoriteIds(): string[] {`
);

// Existing Flashpoint playlist operations now update the active profile too.
edit(
  'src/back/playlist.ts',
  `      await updatePlaylist(state, oldPlaylist, playlist);\n    }\n  }\n}\n\nexport async function savePlaylistGame`,
  `      if (playlist.title.includes('Favorites')) {\n        state.profileManager.setFavorite(gameId, true);\n      }\n      await updatePlaylist(state, oldPlaylist, playlist);\n    }\n  }\n}\n\nexport async function savePlaylistGame`
);

edit(
  'src/back/playlist.ts',
  `      const removedGame = playlist.games.splice(gameIdx, 1);\n      await updatePlaylist(state, oldPlaylist, playlist);`,
  `      const removedGame = playlist.games.splice(gameIdx, 1);\n      if (playlist.title.includes('Favorites')) {\n        state.profileManager.setFavorite(gameId, false);\n      }\n      await updatePlaylist(state, oldPlaylist, playlist);`
);

console.log('Flashpoint Profiles + profile-specific Favorites patch applied.');
