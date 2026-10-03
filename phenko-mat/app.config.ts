import type { ConfigContext, ExpoConfig } from "expo/config";

/*
 * Dynamic app config so per-environment values (bundle ids, Google client ids) come from env vars
 * instead of being hard-coded. Runtime values the JS reads live in `EXPO_PUBLIC_*` (see src/config/env.ts).
 */

const BRAND = "#FFC629";
const IS_DEV = process.env.APP_VARIANT === "development";

/** Reversed iOS client id, e.g. com.googleusercontent.apps.1234-abcd. Enables native Google sign-in. */
const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? "Phenko Mat (Dev)" : "Phenko Mat",
  slug: "phenko-mat",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "phenkomat",
  userInterfaceStyle: "light",
  backgroundColor: "#FBF8F1",
  ios: {
    icon: "./assets/AppIcon.icon",
    bundleIdentifier: IS_DEV ? "com.gauravsunthwal.phenko-mat.dev" : "com.gauravsunthwal.phenko-mat",
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    // Android package names cannot contain hyphens, so "phenko-mat" becomes "phenko_mat" here.
    package: IS_DEV ? "com.gauravsunthwal.phenko_mat.dev" : "com.gauravsunthwal.phenko_mat",
    adaptiveIcon: {
      backgroundColor: BRAND,
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    softwareKeyboardLayoutMode: "resize",
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: "single",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-dev-client",
    "expo-apple-authentication",
    [
      "expo-splash-screen",
      {
        backgroundColor: BRAND,
        image: "./assets/images/splash-icon.png",
        imageWidth: 112,
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Phenko Mat uses your approximate location to show things people are passing on near you.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Phenko Mat needs your photos so you can add pictures of the things you list.",
        cameraPermission: "Phenko Mat uses the camera so you can photograph the things you list.",
        microphonePermission: false,
      },
    ],
    ...(googleIosUrlScheme
      ? [["@react-native-google-signin/google-signin", { iosUrlScheme: googleIosUrlScheme }] as [string, object]]
      : []),
    "./plugins/withSceneLifecycle",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
