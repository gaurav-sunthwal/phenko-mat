"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let auth: Auth | undefined;

/** Firebase only for the moment of sign-in; the session lives in an httpOnly cookie. */
export async function clientAuth() {
  if (!config.apiKey || !config.projectId) throw new Error("Firebase isn't configured (NEXT_PUBLIC_FIREBASE_*).");
  if (!auth) {
    auth = getAuth(getApps().length ? getApp() : initializeApp(config));
    await setPersistence(auth, inMemoryPersistence);
  }
  return auth;
}
