export type FlashpointProfile = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string;
  favorites: string[];
  history: ProfileHistoryEntry[];
};

export type ProfileHistoryEntry = {
  gameId: string;
  playedAt: string;
};

export type ProfileStore = {
  version: 2;
  activeProfileId: string;
  favoritesInitialized: boolean;
  profiles: FlashpointProfile[];
};
