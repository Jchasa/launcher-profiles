import { BackIn } from '@shared/back/types';
import { Paths } from '@shared/Paths';
import * as React from 'react';
import { Link } from 'react-router-dom';

/** Persistent indication of the currently active local Flashpoint profile. */
export const ProfileIndicator: React.FC = () => {
  const [name, setName] = React.useState<string>('Profile');

  const load = React.useCallback(async () => {
    try {
      const result = await window.Shared.back.request(BackIn.GET_PROFILES);
      const active = result.profiles.find(profile => profile.id === result.activeProfileId);
      if (active) setName(active.name);
    } catch {
      // Keep the current label if the backend is not ready yet.
    }
  }, []);

  React.useEffect(() => {
    void load();
    const handleProfileChange = () => { void load(); };
    window.addEventListener('flashpoint-profile-changed', handleProfileChange);
    return () => window.removeEventListener('flashpoint-profile-changed', handleProfileChange);
  }, [load]);

  return (
    <Link
      to={Paths.PROFILES}
      title="Active Flashpoint profile"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        marginRight: 8,
        borderRadius: 4,
        color: 'inherit',
        textDecoration: 'none',
        fontWeight: 600,
        background: 'rgba(255,255,255,0.08)',
      }}>
      <span aria-hidden="true">👤</span>
      <span>{name}</span>
    </Link>
  );
};
