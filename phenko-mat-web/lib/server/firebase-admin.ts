import "server-only";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { firebaseEnv } from "./env";

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const env = firebaseEnv();
  const credential =
    env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY
      ? cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY,
        })
      : applicationDefault();
  return initializeApp({
    credential,
    projectId: env.FIREBASE_PROJECT_ID,
  });
}

export const adminAuth = () => getAuth(app());
