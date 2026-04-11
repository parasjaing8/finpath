const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin -- removes SYSTEM_ALERT_WINDOW permission from the release manifest.
 * This permission is injected by React Native's debug overlay and must not ship to production.
 * Google Play flags it for special review / rejection unless justified.
 */
module.exports = function withRemoveSystemAlertWindow(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;

    if (Array.isArray(manifest['uses-permission'])) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (perm) =>
          perm.$['android:name'] !== 'android.permission.SYSTEM_ALERT_WINDOW'
      );
    }

    return mod;
  });
};
