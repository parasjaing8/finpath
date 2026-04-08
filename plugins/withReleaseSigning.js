const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Expo config plugin — injects release signing config into android/app/build.gradle.
 * Reads credentials from android/keystore.properties (not committed to git).
 * This file lives on the build machine only.
 */
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    const gradle = config.modResults.contents;

    // Skip if already patched
    if (gradle.includes('finpath-release.jks')) {
      return config;
    }

    // 1. Inject keystore.properties loader before android { block
    const keystoreLoader = `
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
`;
    config.modResults.contents = gradle.replace(
      /^(android\s*\{)/m,
      `${keystoreLoader}\n$1`
    );

    // 2. Add release signing config inside signingConfigs { ... }
    config.modResults.contents = config.modResults.contents.replace(
      /(signingConfigs\s*\{[^}]*debug\s*\{[^}]*\})/s,
      `$1
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }`
    );

    // 3. Switch release buildType to use release signing config
    config.modResults.contents = config.modResults.contents.replace(
      /(buildTypes\s*\{[^}]*release\s*\{[^}]*)signingConfig signingConfigs\.debug/s,
      '$1signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug'
    );

    return config;
  });
};
