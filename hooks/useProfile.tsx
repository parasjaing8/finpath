import React, { createContext, useContext, useState, useCallback } from 'react';
import { Profile, getAllProfiles, getProfile } from '../db/queries';

interface ProfileContextType {
  currentProfile: Profile | null;
  profiles: Profile[];
  setCurrentProfileId: (id: number) => Promise<void>;
  refreshProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType>({
  currentProfile: null,
  profiles: [],
  setCurrentProfileId: async () => {},
  refreshProfiles: async () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const refreshProfiles = useCallback(async () => {
    const all = await getAllProfiles();
    setProfiles(all);
    if (currentProfile) {
      const updated = await getProfile(currentProfile.id);
      if (updated) setCurrentProfile(updated);
    }
  }, [currentProfile]);

  const setCurrentProfileId = useCallback(async (id: number) => {
    const p = await getProfile(id);
    if (p) setCurrentProfile(p);
  }, []);

  return (
    <ProfileContext.Provider value={{ currentProfile, profiles, setCurrentProfileId, refreshProfiles }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
