"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let auth: Auth | undefined;

/**
 * The browser only holds Firebase credentials for the moment of sign-in: we exchange the ID token
 * for an httpOnly session cookie and keep nothing in localStorage/IndexedDB.
 */
export async function clientAuth() {
  if (!firebaseConfigured) throw new Error("Firebase is not configured.");
  if (!auth) {
    auth = getAuth(getApps().length ? getApp() : initializeApp(config));
    await setPersistence(auth, inMemoryPersistence);
  }
  return auth;
}
