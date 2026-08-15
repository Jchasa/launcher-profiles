import { BackIn } from '@shared/back/types';
import { FlashpointProfile } from '@shared/profiles/types';
import * as React from 'react';

export const ProfilesPage: React.FC = () => {
  const [profiles, setProfiles] = React.useState<FlashpointProfile[]>([]);
  const [activeId, setActiveId] = React.useState<string>('');
  const [error, setError] = React.useState<string>('');

  const loadProfiles = React.useCallback(async () => {
    setError('');
    try {
      const result = await window.Shared.back.request(BackIn.GET_PROFILES);
      setProfiles(result.profiles);
      setActiveId(result.activeProfileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  React.useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const createProfile = async () => {
    const name = window.prompt('Profile name');
    if (!name) return;
    try {
      await window.Shared.back.request(BackIn.CREATE_PROFILE, name);
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const switchProfile = async (profileId: string) => {
    try {
      await window.Shared.back.request(BackIn.SWITCH_PROFILE, profileId);
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const renameProfile = async (profile: FlashpointProfile) => {
    const name = window.prompt('New profile name', profile.name);
    if (!name || name === profile.name) return;
    try {
      await window.Shared.back.request(BackIn.RENAME_PROFILE, profile.id, name);
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteProfile = async (profile: FlashpointProfile) => {
    if (!window.confirm(`Delete the profile "${profile.name}"?`)) return;
    try {
      await window.Shared.back.request(BackIn.DELETE_PROFILE, profile.id);
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Profiles</h1>
          <div style={{ opacity: 0.7 }}>Separate favorites and play history for each person using this Flashpoint installation.</div>
        </div>
        <button onClick={createProfile}>+ Add Profile</button>
      </div>

      {error && (
        <div style={{ padding: 12, marginBottom: 16, borderRadius: 4, background: 'rgba(180, 50, 50, 0.2)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {profiles.map(profile => {
          const active = profile.id === activeId;
          return (
            <div key={profile.id} style={{ padding: 20, borderRadius: 8, border: `2px solid ${active ? 'var(--accent-color, #6aa9ff)' : 'rgba(255,255,255,0.15)'}` }}>
              <h2 style={{ marginTop: 0 }}>{profile.name}</h2>
              <div style={{ opacity: 0.7, marginBottom: 16 }}>
                {profile.favorites.length} favorites · {profile.history.length} plays
              </div>
              {active ? (
                <div style={{ marginBottom: 12, fontWeight: 600 }}>Active profile</div>
              ) : (
                <button onClick={() => void switchProfile(profile.id)} style={{ marginRight: 8 }}>Switch</button>
              )}
              <button onClick={() => void renameProfile(profile)} style={{ marginRight: 8 }}>Rename</button>
              {!active && profiles.length > 1 && (
                <button onClick={() => void deleteProfile(profile)}>Delete</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
