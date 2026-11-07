/**
 * UIScene-Lebenszyklus für iOS (vom iOS-27-SDK verlangt, sonst Absturz beim Start:
 * "UIScene life cycle is required for apps built with this SDK").
 *
 * Expo SDK 57 enthält ExpoAppSceneDelegate bereits, die prebuild-Vorlage nutzt ihn aber erst ab SDK 58.
 * Dieses Plugin bildet die SDK-58-Vorlage nach:
 *  - SceneDelegate.swift (Unterklasse von ExpoAppSceneDelegate) anlegen und ins Xcode-Projekt aufnehmen
 *  - UIApplicationSceneManifest in Info.plist
 *  - AppDelegate: ExpoReactNativeFactoryProvider, Fenster + React-Start übernimmt der SceneDelegate
 * Kann entfernt werden, sobald das Projekt auf Expo SDK 58 aktualisiert ist.
 */
const fs = require('fs');
const path = require('path');
const {
  withAppDelegate,
  withInfoPlist,
  withXcodeProject,
  IOSConfig,
} = require('expo/config-plugins');

const SCENE_DELEGATE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

function patchAppDelegate(src) {
  if (src.includes('ExpoReactNativeFactoryProvider')) return src;
  let out = src.replace(
    /class AppDelegate: ExpoAppDelegate \{/,
    'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {'
  );
  // Fenster anlegen + React starten macht jetzt der SceneDelegate.
  out = out.replace(
    /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/,
    '\n    // The window is created and React Native is started by `SceneDelegate` under the\n' +
      '    // scene-based life cycle (required by the iOS 27 SDK).\n'
  );
  // URL-/Universal-Link-Overrides: unter dem Scene-Lebenszyklus leitet ExpoAppSceneDelegate
  // diese Ereignisse selbst an ExpoAppDelegate und RCTLinkingManager weiter (wie in SDK 58).
  out = out.replace(/\n  \/\/ Linking API\n[\s\S]*?\n  \/\/ Universal Links\n[\s\S]*?\n  \}\n(?=\}\n)/, '\n');
  if (!out.includes('ExpoReactNativeFactoryProvider') || out.includes('UIScreen.main.bounds')) {
    throw new Error('with-scene-lifecycle: AppDelegate.swift hat ein unerwartetes Format – Plugin prüfen.');
  }
  return out;
}

const withSceneLifecycle = (config) => {
  config = withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('with-scene-lifecycle: nur Swift-AppDelegate unterstützt.');
    }
    cfg.modResults.contents = patchAppDelegate(cfg.modResults.contents);
    return cfg;
  });

  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

  config = withXcodeProject(config, (cfg) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    const file = path.join(cfg.modRequest.platformProjectRoot, projectName, 'SceneDelegate.swift');
    fs.writeFileSync(file, SCENE_DELEGATE);
    const groupPath = `${projectName}/SceneDelegate.swift`;
    if (!cfg.modResults.hasFile(groupPath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: groupPath,
        groupName: projectName,
        project: cfg.modResults,
      });
    }
    return cfg;
  });

  return config;
};

module.exports = withSceneLifecycle;
