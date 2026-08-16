import * as fs from 'fs-extra';
import * as path from 'path';
import { FlashpointProfile } from '@shared/profiles/types';
import { Playlist } from 'flashpoint-launcher';

const STORE_FILENAME = 'playlist-ownership.json';
const STORE_VERSION = 1;

type OwnershipStore = {
  version: 1;
  owners: Record<string, string>;
  shared: string[];
};

/**
 * Tracks which profile owns user playlists without changing the playlist JSON
 * format. Playlists that existed before Profiles are treated as shared until
 * the user creates/imports a new playlist or a new playlist file appears.
 */
export class PlaylistOwnershipManager {
  private readonly filePath: string;
  private store: OwnershipStore;

  constructor(configFolder: string) {
    this.filePath = path.join(configFolder, STORE_FILENAME);
    this.store = this.load();
  }

  private load(): OwnershipStore {
    try {
      const data = fs.readJsonSync(this.filePath) as Partial<OwnershipStore>;
      if (data.version === STORE_VERSION && data.owners && Array.isArray(data.shared)) {
        return {
          version: STORE_VERSION,
          owners: { ...data.owners },
          shared: [...data.shared]
        };
      }
    } catch {
      // First run or unreadable registry.
    }

    return { version: STORE_VERSION, owners: {}, shared: [] };
  }

  private save(): void {
    fs.ensureDirSync(path.dirname(this.filePath));
    fs.writeJsonSync(this.filePath, this.store, { spaces: 2 });
  }

  /** Existing playlists are shared unless explicitly claimed. */
  initializeExisting(playlists: Playlist[]): void {
    let changed = false;
    for (const playlist of playlists) {
      if (!playlist.id) continue;
      if (this.store.owners[playlist.id] || this.store.shared.includes(playlist.id)) continue;
      this.store.shared.push(playlist.id);
      changed = true;
    }
    if (changed) this.save();
  }

  assignToProfile(playlist: Playlist | string, profile: FlashpointProfile | string): void {
    const playlistId = typeof playlist === 'string' ? playlist : playlist.id;
    const profileId = typeof profile === 'string' ? profile : profile.id;
    if (!playlistId || !profileId) return;

    delete this.store.owners[playlistId];
    this.store.shared = this.store.shared.filter(id => id !== playlistId);
    this.store.owners[playlistId] = profileId;
    this.save();
  }

  markShared(playlist: Playlist | string): void {
    const playlistId = typeof playlist === 'string' ? playlist : playlist.id;
    if (!playlistId) return;

    delete this.store.owners[playlistId];
    if (!this.store.shared.includes(playlistId)) this.store.shared.push(playlistId);
    this.save();
  }

  ownerOf(playlistId: string): string | undefined {
    return this.store.owners[playlistId];
  }

  isShared(playlistId: string): boolean {
    return this.store.shared.includes(playlistId) || !this.store.owners[playlistId];
  }

  visibleToProfile(playlist: Playlist, profileId: string): boolean {
    // Favorites are a special profile projection and are always visible.
    if (playlist.title.includes('Favorites')) return true;
    const owner = this.store.owners[playlist.id];
    return !owner || owner === profileId;
  }

  remove(playlistId: string): void {
    if (delete this.store.owners[playlistId] || this.store.shared.includes(playlistId)) {
      this.store.shared = this.store.shared.filter(id => id !== playlistId);
      this.save();
    }
  }
}
