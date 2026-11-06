'use client';
import { getAuth, signOut } from 'firebase/auth';

/**
 * Sign in with Google is disabled in favor of Code Access.
 */
export async function signInWithGoogle() {
  console.log("Google Sign-in is replaced by Code Access.");
}

/**
 * Signs out the current user by clearing the local access code and Firebase session.
 */
export async function signOutUser() {
  const auth = getAuth();
  try {
    await signOut(auth);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nagepro_access_granted');
      window.location.href = '/login';
    }
  } catch (error) {
    console.error("Sign out error:", error);
  }
}