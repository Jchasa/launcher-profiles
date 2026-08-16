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

console.log('Flashpoint Profiles patch applied.');
