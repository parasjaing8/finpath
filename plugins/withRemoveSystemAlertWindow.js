const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS_TO_REMOVE = [
  'android.permission.SYSTEM_ALERT_WINDOW',   // injected by RN debug overlay; Play Store flags for review
  'android.permission.READ_EXTERNAL_STORAGE', // scoped storage on Android 11+; not needed for cacheDir sharing
  'android.permission.WRITE_EXTERNAL_STORAGE', // same — CSV export uses cacheDirectory + expo-sharing
];

module.exports = function withRemoveSystemAlertWindow(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;

    if (Array.isArray(manifest['uses-permission'])) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (perm) => !PERMISSIONS_TO_REMOVE.includes(perm.$['android:name'])
      );
    }

    return mod;
  });
};
