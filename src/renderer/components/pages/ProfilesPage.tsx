import { BackIn } from '@shared/back/types';
import { FlashpointProfile } from '@shared/profiles/types';
import * as React from 'react';

type DialogState =
  | { type: 'create' }
  | { type: 'rename'; profile: FlashpointProfile }
  | { type: 'delete'; profile: FlashpointProfile }
  | null;

export const ProfilesPage: React.FC = () => {
  const [profiles, setProfiles] = React.useState<FlashpointProfile[]>([]);
  const [activeId, setActiveId] = React.useState<string>('');
  const [error, setError] = React.useState<string>('');
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [dialogValue, setDialogValue] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);

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

  const openCreate = () => {
    setDialog({ type: 'create' });
    setDialogValue('');
    setError('');
  };

  const openRename = (profile: FlashpointProfile) => {
    setDialog({ type: 'rename', profile });
    setDialogValue(profile.name);
    setError('');
  };

  const openDelete = (profile: FlashpointProfile) => {
    setDialog({ type: 'delete', profile });
    setDialogValue('');
    setError('');
  };

  const closeDialog = () => {
    if (!busy) setDialog(null);
  };

  const submitDialog = async () => {
    if (!dialog || busy) return;

    setBusy(true);
    setError('');
    try {
      if (dialog.type === 'create') {
        const name = dialogValue.trim();
        if (!name) throw new Error('Profile name cannot be empty');
        await window.Shared.back.request(BackIn.CREATE_PROFILE, name);
      } else if (dialog.type === 'rename') {
        const name = dialogValue.trim();
        if (!name) throw new Error('Profile name cannot be empty');
        if (name !== dialog.profile.name) {
          await window.Shared.back.request(BackIn.RENAME_PROFILE, dialog.profile.id, name);
        }
      } else {
        await window.Shared.back.request(BackIn.DELETE_PROFILE, dialog.profile.id);
      }

      setDialog(null);
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const switchProfile = async (profileId: string) => {
    setBusy(true);
    setError('');
    try {
      await window.Shared.back.request(BackIn.SWITCH_PROFILE, profileId);
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const dialogTitle = dialog?.type === 'create'
    ? 'Create Profile'
    : dialog?.type === 'rename'
      ? 'Rename Profile'
      : 'Delete Profile';

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Profiles</h1>
          <div style={{ opacity: 0.7 }}>Separate favorites and play history for each person using this Flashpoint installation.</div>
        </div>
        <button onClick={openCreate} disabled={busy}>+ Add Profile</button>
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
                <button onClick={() => void switchProfile(profile.id)} disabled={busy} style={{ marginRight: 8 }}>Switch</button>
              )}
              <button onClick={() => openRename(profile)} disabled={busy} style={{ marginRight: 8 }}>Rename</button>
              {!active && profiles.length > 1 && (
                <button onClick={() => openDelete(profile)} disabled={busy}>Delete</button>
              )}
            </div>
          );
        })}
      </div>

      {dialog && (
        <div
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeDialog();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.65)'
          }}>
          <div
            role="dialog"
            aria-modal="true"
            style={{
              width: 420,
              maxWidth: 'calc(100vw - 40px)',
              padding: 24,
              borderRadius: 8,
              background: 'var(--layout-primary-background)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
            }}>
            <h2 style={{ marginTop: 0 }}>{dialogTitle}</h2>

            {dialog.type === 'delete' ? (
              <p>Delete the profile <strong>{dialog.profile.name}</strong>? This removes its profile-specific favorites and play history.</p>
            ) : (
              <input
                autoFocus
                value={dialogValue}
                onChange={event => setDialogValue(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') void submitDialog();
                  if (event.key === 'Escape') closeDialog();
                }}
                disabled={busy}
                style={{ width: '100%', boxSizing: 'border-box', padding: 10, marginBottom: 20 }}
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={closeDialog} disabled={busy}>Cancel</button>
              <button onClick={() => void submitDialog()} disabled={busy || (dialog.type !== 'delete' && !dialogValue.trim())}>
                {busy ? 'Working…' : dialog.type === 'delete' ? 'Delete' : dialog.type === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
