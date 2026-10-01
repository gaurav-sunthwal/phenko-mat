import "server-only";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "./env";

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const e = env();
  const credential =
    e.FIREBASE_CLIENT_EMAIL && e.FIREBASE_PRIVATE_KEY
      ? cert({ projectId: e.FIREBASE_PROJECT_ID, clientEmail: e.FIREBASE_CLIENT_EMAIL, privateKey: e.FIREBASE_PRIVATE_KEY })
      : applicationDefault();
  return initializeApp({ credential, projectId: e.FIREBASE_PROJECT_ID });
}

export const adminAuth = () => getAuth(app());
