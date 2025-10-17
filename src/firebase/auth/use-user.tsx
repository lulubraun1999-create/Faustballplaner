'use client';

import { useContext } from 'react';
import { User } from 'firebase/auth';
import { FirebaseContext, FirebaseContextState } from '@/firebase/provider';

/**
 * Return type for the useUser hook.
 */
export interface UserHookResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 *
 * This hook is a lightweight alternative to useFirebase() when only
 * user authentication information is needed.
 *
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => {
  const context = useContext<FirebaseContextState | undefined>(FirebaseContext);

  if (context === undefined) {
    throw new Error('useUser must be used within a FirebaseProvider.');
  }

  // Extracts only the user-related state from the main Firebase context
  const { user, isUserLoading, userError } = context;
  
  return { user, isUserLoading, userError };
};
