import * as fs from 'fs-extra';
import * as path from 'path';
import { FlashpointProfile, ProfileStore } from '@shared/profiles/types';
import { uuid } from './util/uuid';

const STORE_FILENAME = 'profiles.json';
const STORE_VERSION = 2;

function createProfile(name: string): FlashpointProfile {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    name,
    createdAt: now,
    lastUsedAt: now,
    favorites: [],
    history: []
  };
}

export class ProfileManager {
  private store: ProfileStore;
  private readonly filePath: string;

  constructor(configFolder: string) {
    this.filePath = path.join(configFolder, STORE_FILENAME);
    this.store = this.load();
  }

  private load(): ProfileStore {
    try {
      const data = fs.readJsonSync(this.filePath) as Partial<ProfileStore> & { version?: number };
      if (Array.isArray(data.profiles) && data.profiles.length > 0) {
        const activeProfileId = data.profiles.some(p => p.id === data.activeProfileId)
          ? data.activeProfileId as string
          : data.profiles[0].id;

        if (data.version === STORE_VERSION) {
          return {
            version: STORE_VERSION,
            activeProfileId,
            favoritesInitialized: data.favoritesInitialized === true,
            profiles: data.profiles
          };
        }

        // Migrate the MVP profile store. Favorites are imported from the
        // existing Flashpoint Favorites playlist on the first playlist sync.
        if (data.version === 1) {
          const store: ProfileStore = {
            version: STORE_VERSION,
            activeProfileId,
            favoritesInitialized: false,
            profiles: data.profiles
          };
          this.store = store;
          this.save();
          return store;
        }
      }
    } catch {
      // First run or an unreadable profile store.
    }

    const profile = createProfile('Default');
    const store: ProfileStore = {
      version: STORE_VERSION,
      activeProfileId: profile.id,
      favoritesInitialized: false,
      profiles: [profile]
    };
    this.store = store;
    this.save();
    return store;
  }

  private save(): void {
    fs.ensureDirSync(path.dirname(this.filePath));
    fs.writeJsonSync(this.filePath, this.store, { spaces: 2 });
  }

  list(): FlashpointProfile[] {
    return this.store.profiles.map(profile => ({
      ...profile,
      favorites: [...profile.favorites],
      history: [...profile.history]
    }));
  }

  active(): FlashpointProfile {
    const profile = this.store.profiles.find(p => p.id === this.store.activeProfileId);
    if (!profile) {
      throw new Error('Active profile does not exist');
    }
    return {
      ...profile,
      favorites: [...profile.favorites],
      history: [...profile.history]
    };
  }

  create(name: string): FlashpointProfile {
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Profile name cannot be empty');
    if (this.store.profiles.some(p => p.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error('A profile with that name already exists');
    }

    const profile = createProfile(cleanName);
    this.store.profiles.push(profile);
    this.save();
    return profile;
  }

  switchTo(profileId: string): FlashpointProfile {
    const profile = this.store.profiles.find(p => p.id === profileId);
    if (!profile) throw new Error('Profile does not exist');

    profile.lastUsedAt = new Date().toISOString();
    this.store.activeProfileId = profile.id;
    this.save();
    return this.active();
  }

  rename(profileId: string, name: string): FlashpointProfile {
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Profile name cannot be empty');
    if (this.store.profiles.some(p => p.id !== profileId && p.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error('A profile with that name already exists');
    }

    const profile = this.store.profiles.find(p => p.id === profileId);
    if (!profile) throw new Error('Profile does not exist');

    profile.name = cleanName;
    this.save();
    return { ...profile, favorites: [...profile.favorites], history: [...profile.history] };
  }

  remove(profileId: string): void {
    if (this.store.profiles.length === 1) throw new Error('The last profile cannot be deleted');
    if (profileId === this.store.activeProfileId) throw new Error('Switch profiles before deleting the active profile');

    const index = this.store.profiles.findIndex(p => p.id === profileId);
    if (index < 0) throw new Error('Profile does not exist');

    this.store.profiles.splice(index, 1);
    this.save();
  }

  isFavoritesInitialized(): boolean {
    return this.store.favoritesInitialized;
  }

  activeFavoriteIds(): string[] {
    return [...this.active().favorites];
  }

  initializeFavorites(gameIds: string[]): void {
    if (this.store.favoritesInitialized) return;

    const profile = this.store.profiles.find(p => p.id === this.store.activeProfileId);
    if (!profile) throw new Error('Active profile does not exist');

    profile.favorites = [...new Set(gameIds)];
    this.store.favoritesInitialized = true;
    this.save();
  }

  setFavorite(gameId: string, favorite: boolean): FlashpointProfile {
    const profile = this.store.profiles.find(p => p.id === this.store.activeProfileId);
    if (!profile) throw new Error('Active profile does not exist');

    const index = profile.favorites.indexOf(gameId);
    if (favorite && index < 0) profile.favorites.push(gameId);
    if (!favorite && index >= 0) profile.favorites.splice(index, 1);

    this.save();
    return this.active();
  }

  recordPlay(gameId: string): FlashpointProfile {
    const profile = this.store.profiles.find(p => p.id === this.store.activeProfileId);
    if (!profile) throw new Error('Active profile does not exist');

    profile.history.unshift({ gameId, playedAt: new Date().toISOString() });
    profile.history = profile.history.slice(0, 500);
    profile.lastUsedAt = new Date().toISOString();
    this.save();
    return this.active();
  }
}
