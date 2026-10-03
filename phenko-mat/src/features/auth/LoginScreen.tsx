import { FirebaseError } from "firebase/app";
import { signOut as firebaseSignOut, type User } from "firebase/auth";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppleLogo, Button, GoogleLogo, Text, TextField, Wordmark } from "@/components/ui";
import { env, firebaseConfigured } from "@/config/env";
import { ApiRequestError, isApiError } from "@/lib/api/errors";
import { firebaseAuth } from "@/lib/firebase";
import { alpha, colors, MAX_CONTENT_WIDTH, radius } from "@/theme";
import {
  appleAvailable,
  appleSignIn,
  emailSignIn,
  emailSignUp,
  googleAvailable,
  googleSignIn,
  resendVerification,
  resetPassword,
  SignInCancelled,
} from "./providers";
import { completeSignIn } from "./session";

type Mode = "signin" | "signup";

const FIREBASE_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/invalid-email": "That email doesn't look right.",
  "auth/email-already-in-use": "An account with this email already exists. Try signing in.",
  "auth/weak-password": "Use at least 8 characters for your password.",
  "auth/too-many-requests": "Too many attempts. Please wait a bit and try again.",
  "auth/account-exists-with-different-credential": "You already have an account with this email using a different sign-in method.",
  "auth/network-request-failed": "Network error. Check your connection.",
};

function describe(e: unknown) {
  if (e instanceof FirebaseError) return FIREBASE_MESSAGES[e.code] ?? "Sign-in failed. Please try again.";
  if (e instanceof ApiRequestError) return e.message;
  return "Something went wrong. Please try again.";
}

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [unverified, setUnverified] = useState<User | null>(null);
  const [showApple, setShowApple] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    void appleAvailable().then(setShowApple);
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      if (!(e instanceof SignInCancelled)) setError(describe(e));
    } finally {
      setBusy(false);
    }
  }

  /** Firebase sign-in → our server. Keeps an unverified user around so we can resend the email. */
  const signInWith = (provider: () => Promise<User>) =>
    run(async () => {
      let user: User | null = null;
      try {
        await completeSignIn(async () => (user = await provider()));
      } catch (e) {
        if (isApiError(e, "EMAIL_NOT_VERIFIED") && user) setUnverified(user);
        else await firebaseSignOut(firebaseAuth()).catch(() => undefined);
        throw e;
      }
    });

  const submitEmail = () => {
    if (mode === "signup") {
      return run(async () => {
        await emailSignUp(name, email, password);
        setMode("signin");
        setPassword("");
        setNotice(`We sent a verification link to ${email.trim()}. Verify, then sign in.`);
      });
    }
    return signInWith(() => emailSignIn(email, password));
  };

  const resend = () =>
    run(async () => {
      if (!unverified) return;
      await resendVerification(unverified);
      setUnverified(null);
      setNotice("Verification email sent again. Check your inbox (and spam).");
    });

  const forgot = () =>
    run(async () => {
      await resetPassword(email);
      // Same message whether or not the account exists (no account enumeration).
      setNotice("If an account exists for that email, a reset link is on its way.");
    });

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <View style={styles.column}>
        <Wordmark />

        <View style={styles.hero}>
          <Text weight="black" size={41.6} leading={1.05} style={styles.headline} accessibilityRole="header">
            Don&apos;t throw it.{"\n"}Pass it on.
          </Text>
          <Text size="lg" style={styles.lead}>
            Sign in to swipe on things your neighbours are passing on.
          </Text>

          {!firebaseConfigured ? (
            <View style={styles.notConfigured}>
              <Text size="sm">
                Sign-in isn&apos;t configured yet. Add the EXPO_PUBLIC_FIREBASE_* values to .env.local and restart the dev server.
              </Text>
            </View>
          ) : (
            <View style={styles.form}>
              {showApple || googleAvailable ? (
                <View style={styles.social}>
                  {showApple ? (
                    <Button block label="Continue with Apple" icon={<AppleLogo />} onPress={() => signInWith(appleSignIn)} disabled={busy} />
                  ) : null}
                  {googleAvailable ? (
                    <Button block variant="white" label="Continue with Google" icon={<GoogleLogo />} onPress={() => signInWith(googleSignIn)} disabled={busy} />
                  ) : null}
                </View>
              ) : null}

              {showApple || googleAvailable ? (
                <View style={styles.divider}>
                  <View style={styles.rule} />
                  <Text weight="bold" size="xs" color={alpha(colors.ink, 0.6)}>
                    OR USE EMAIL
                  </Text>
                  <View style={styles.rule} />
                </View>
              ) : null}

              <View style={styles.fields}>
                {mode === "signup" ? (
                  <TextField
                    tone="plain"
                    value={name}
                    onChangeText={setName}
                    autoComplete="name"
                    textContentType="name"
                    maxLength={60}
                    placeholder="Your name"
                    accessibilityLabel="Your name"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                ) : null}
                <TextField
                  ref={emailRef}
                  tone="plain"
                  value={email}
                  onChangeText={setEmail}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Email"
                  accessibilityLabel="Email"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
                <TextField
                  ref={passwordRef}
                  tone="plain"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  textContentType={mode === "signup" ? "newPassword" : "password"}
                  placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
                  accessibilityLabel="Password"
                  returnKeyType="go"
                  onSubmitEditing={submitEmail}
                />

                {error ? (
                  <View style={styles.message} accessibilityRole="alert">
                    <Text weight="semibold" size="sm" color={colors.dangerDeep}>
                      {error}
                    </Text>
                    {unverified ? (
                      <Pressable onPress={resend} accessibilityRole="button">
                        <Text weight="semibold" size="sm" color={colors.dangerDeep} style={styles.underline}>
                          Resend verification email
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {notice ? (
                  <View style={styles.message}>
                    <Text weight="semibold" size="sm">
                      {notice}
                    </Text>
                  </View>
                ) : null}

                <Button
                  block
                  size="lg"
                  weight="extrabold"
                  label={busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
                  onPress={submitEmail}
                  disabled={busy}
                />
              </View>

              <View style={styles.links}>
                <Pressable
                  onPress={() => {
                    setMode(mode === "signin" ? "signup" : "signin");
                    setError(null);
                    setNotice(null);
                  }}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text weight="semibold" size="sm" style={styles.underline}>
                    {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
                  </Text>
                </Pressable>
                {mode === "signin" ? (
                  <Pressable onPress={forgot} accessibilityRole="button" hitSlop={8}>
                    <Text weight="semibold" size="sm" color={alpha(colors.ink, 0.7)} style={styles.underline}>
                      Forgot password?
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        </View>

        <Text size="xs" align="center" color={alpha(colors.ink, 0.7)}>
          By continuing you agree to our{" "}
          <Text size="xs" weight="bold" color={alpha(colors.ink, 0.7)} onPress={() => void WebBrowser.openBrowserAsync(`${env.apiUrl}/terms`)} accessibilityRole="link">
            Terms
          </Text>{" "}
          and{" "}
          <Text size="xs" weight="bold" color={alpha(colors.ink, 0.7)} onPress={() => void WebBrowser.openBrowserAsync(`${env.apiUrl}/privacy`)} accessibilityRole="link">
            Privacy policy
          </Text>
          , and to meet safely, be kind, and only list things you own.
        </Text>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.honey },
  content: { flexGrow: 1, paddingHorizontal: 24, alignItems: "center" },
  column: { flex: 1, width: "100%", maxWidth: MAX_CONTENT_WIDTH - 40 },
  hero: { flex: 1, justifyContent: "center", paddingVertical: 40 },
  headline: { letterSpacing: -1 },
  lead: { marginTop: 12, marginBottom: 32 },
  notConfigured: { borderRadius: radius.lg, backgroundColor: colors.white, padding: 16 },
  form: { gap: 20 },
  social: { gap: 12 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  rule: { flex: 1, height: 1, backgroundColor: alpha(colors.ink, 0.15) },
  fields: { gap: 12 },
  message: { borderRadius: radius.md, backgroundColor: alpha(colors.white, 0.7), paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  links: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  underline: { textDecorationLine: "underline" },
});
