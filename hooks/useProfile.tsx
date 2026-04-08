import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Profile, getAllProfiles, getProfile } from '../db/queries';

interface ProfileContextType {
  currentProfile: Profile | null;
  profiles: Profile[];
  setCurrentProfileId: (id: number) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  logout: () => void;
}

const ProfileContext = createContext<ProfileContextType>({
  currentProfile: null,
  profiles: [],
  setCurrentProfileId: async () => {},
  refreshProfiles: async () => {},
  logout: () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const currentProfileRef = useRef(currentProfile);
  currentProfileRef.current = currentProfile;

  const refreshProfiles = useCallback(async () => {
    const all = await getAllProfiles();
    setProfiles(all);
    if (currentProfileRef.current) {
      const updated = await getProfile(currentProfileRef.current.id);
      if (updated) setCurrentProfile(updated);
    }
  }, []);

  const setCurrentProfileId = useCallback(async (id: number) => {
    const p = await getProfile(id);
    if (p) setCurrentProfile(p);
  }, []);

  const logout = useCallback(() => {
    setCurrentProfile(null);
  }, []);

  return (
    <ProfileContext.Provider value={{ currentProfile, profiles, setCurrentProfileId, refreshProfiles, logout }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
