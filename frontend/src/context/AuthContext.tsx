import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, profileApi, UserProfile } from "../lib/api";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    try {
      const res = await profileApi.get();
      setProfile(res.profile);
    } catch (err) {
      console.error("Error loading user profile in context:", err);
      setProfile(null);
    }
  };

  useEffect(() => {
    let active = true;

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) console.error("Error getting session:", error);
      if (!active) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          const res = await profileApi.get();
          if (active) setProfile(res.profile);
        } catch (err) {
          console.error("Error fetching initial profile:", err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          const res = await profileApi.get();
          if (active) setProfile(res.profile);
        } catch (err) {
          console.error("Error fetching profile on auth change:", err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
