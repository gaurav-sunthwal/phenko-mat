const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

/*
 * iOS 27 asserts at launch (EXC_BREAKPOINT in _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption)
 * unless the app adopts the UIScene life cycle. Expo 57 ships `ExpoAppSceneDelegate` for this, but the prebuild
 * template doesn't wire it up yet, so this plugin:
 *  - declares a scene manifest in Info.plist that uses Expo's scene delegate, and
 *  - makes AppDelegate an `ExpoReactNativeFactoryProvider` and stops it creating the window itself
 *    (the scene delegate creates the window and starts React Native into it).
 */

const WINDOW_BLOCK = /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

function withSceneInfoPlist(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "EXExpoAppSceneDelegate",
          },
        ],
      },
    };
    return config;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== "swift") {
      throw new Error("withSceneLifecycle only supports a Swift AppDelegate");
    }
    let src = config.modResults.contents;

    if (!src.includes("ExpoReactNativeFactoryProvider")) {
      src = src.replace(
        "class AppDelegate: ExpoAppDelegate {",
        "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {"
      );
    }
    src = src.replace(WINDOW_BLOCK, "\n    // The window and React Native are started by ExpoAppSceneDelegate (see plugins/withSceneLifecycle.js).\n");

    if (!src.includes("ExpoReactNativeFactoryProvider") || WINDOW_BLOCK.test(src)) {
      throw new Error("withSceneLifecycle: AppDelegate.swift didn't match the expected template; update the plugin");
    }
    config.modResults.contents = src;
    return config;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneAppDelegate(withSceneInfoPlist(config));
};
