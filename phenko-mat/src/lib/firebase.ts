import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from "firebase/auth";
import { env, firebaseConfigured } from "@/config/env";

/*
 * Unlike the web client (which trades the ID token for an httpOnly cookie and forgets it), the app
 * keeps its Firebase session in AsyncStorage (app-sandboxed) so the user stays signed in; the SDK
 * refreshes the 1-hour ID token automatically and we send it as a bearer token.
 */

let auth: Auth | undefined;

export function firebaseAuth(): Auth {
  if (!firebaseConfigured) throw new Error("Firebase is not configured. Fill in EXPO_PUBLIC_FIREBASE_* in .env.local.");
  if (auth) return auth;

  const app = getApps().length ? getApp() : initializeApp(env.firebase);
  try {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Fast Refresh re-evaluates this module; auth was already initialised for this app.
    auth = getAuth(app);
  }
  return auth;
}
