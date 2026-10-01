import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { Platform } from "react-native";
import { env, googleConfigured } from "@/config/env";
import { firebaseAuth } from "@/lib/firebase";

/*
 * Native sign-in providers. Each resolves to a Firebase `User`; `completeSignIn` (session.ts) then
 * registers it with our API. Native SDKs are loaded lazily so the app still runs (email only) in
 * builds that don't include them.
 */

/** Thrown when the user backs out of a native sign-in sheet — not an error worth showing. */
export class SignInCancelled extends Error {}

export async function emailSignIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
  return cred.user;
}

/** Creates the account, sends the verification email and signs out again (verify first, like web). */
export async function emailSignUp(name: string, email: string, password: string) {
  if (password.length < 8) throw new FirebaseError("auth/weak-password", "");
  const auth = firebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name.trim()) await updateProfile(cred.user, { displayName: name.trim().slice(0, 60) });
  await sendEmailVerification(cred.user);
  await signOut(auth);
}

export async function resendVerification(user: User) {
  await sendEmailVerification(user);
  await signOut(firebaseAuth());
}

export async function resetPassword(email: string) {
  if (!email.trim()) throw new FirebaseError("auth/invalid-email", "");
  await sendPasswordResetEmail(firebaseAuth(), email.trim());
}

/* ---------- Google ---------- */

let googleConfiguredOnce = false;

/** iOS additionally needs its own client id (and the URL scheme baked into the build). */
export const googleAvailable =
  googleConfigured && (Platform.OS === "android" || (Platform.OS === "ios" && Boolean(env.google.iosClientId)));

export async function googleSignIn(): Promise<User> {
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = await import(
    "@react-native-google-signin/google-signin"
  );
  if (!googleConfiguredOnce) {
    GoogleSignin.configure({ webClientId: env.google.webClientId, iosClientId: env.google.iosClientId });
    googleConfiguredOnce = true;
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res) || !res.data.idToken) throw new SignInCancelled();
    const cred = await signInWithCredential(firebaseAuth(), GoogleAuthProvider.credential(res.data.idToken));
    return cred.user;
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) {
      throw new SignInCancelled();
    }
    throw e;
  }
}

/* ---------- Apple ---------- */

export const appleAvailable = () => (Platform.OS === "ios" ? AppleAuthentication.isAvailableAsync() : Promise.resolve(false));

export async function appleSignIn(): Promise<User> {
  // Firebase checks sha256(nonce) inside Apple's token against the raw nonce we pass it: replay protection.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const apple = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!apple.identityToken) throw new Error("Apple didn't return an identity token.");
    const provider = new OAuthProvider("apple.com");
    const cred = await signInWithCredential(firebaseAuth(), provider.credential({ idToken: apple.identityToken, rawNonce }));
    // Apple only shares the name on the very first sign-in; keep it.
    const fullName = [apple.fullName?.givenName, apple.fullName?.familyName].filter(Boolean).join(" ");
    if (fullName && !cred.user.displayName) await updateProfile(cred.user, { displayName: fullName.slice(0, 60) });
    return cred.user;
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") throw new SignInCancelled();
    throw e;
  }
}
