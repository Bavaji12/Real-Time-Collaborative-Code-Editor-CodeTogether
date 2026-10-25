import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

export interface UserState {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  isGuest: boolean;
}

interface AuthContextType {
  user: UserState | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: (name: string) => void;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  rawFirebaseUser: User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_STORAGE_KEY = 'codetogether_guest_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserState | null>(null);
  const [rawFirebaseUser, setRawFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setRawFirebaseUser(firebaseUser);
        const userObj: UserState = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || `${firebaseUser.uid}@codetogether.io`,
          displayName: firebaseUser.displayName || 'Developer',
          photoURL: firebaseUser.photoURL,
          isGuest: false,
        };
        setUser(userObj);

        // Sync with backend database
        try {
          const token = await firebaseUser.getIdToken();
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(userObj),
          });
        } catch (err) {
          console.warn('Could not sync user with backend:', err);
        }
        setLoading(false);
      } else {
        setRawFirebaseUser(null);
        // Check local guest user
        const savedGuest = localStorage.getItem(GUEST_STORAGE_KEY);
        if (savedGuest) {
          try {
            setUser(JSON.parse(savedGuest));
          } catch {
            localStorage.removeItem(GUEST_STORAGE_KEY);
            createDefaultGuest();
          }
        } else {
          createDefaultGuest();
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const createDefaultGuest = () => {
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const guestUser: UserState = {
      uid: `guest_${Math.random().toString(36).substring(2, 9)}`,
      email: `guest-${randomSuffix}@codetogether.local`,
      displayName: `Dev-${randomSuffix}`,
      photoURL: null,
      isGuest: true,
    };
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestUser));
    setUser(guestUser);
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      alert('Sign-in failed: ' + (error.message || 'Unknown error'));
      setLoading(false);
    }
  };

  const signInAsGuest = (name: string) => {
    const trimmed = name.trim() || 'Collaborator';
    const guestUser: UserState = {
      uid: user?.isGuest && user.uid ? user.uid : `guest_${Math.random().toString(36).substring(2, 9)}`,
      email: `${trimmed.toLowerCase().replace(/\s+/g, '')}@guest.local`,
      displayName: trimmed,
      photoURL: null,
      isGuest: true,
    };
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestUser));
    setUser(guestUser);
  };

  const logout = async () => {
    if (rawFirebaseUser) {
      await signOut(auth);
    }
    createDefaultGuest();
  };

  const getIdToken = async (): Promise<string | null> => {
    if (rawFirebaseUser) {
      return await rawFirebaseUser.getIdToken();
    }
    return null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInAsGuest,
        logout,
        getIdToken,
        rawFirebaseUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
