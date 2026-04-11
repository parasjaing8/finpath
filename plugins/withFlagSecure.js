const { withMainActivity } = require('@expo/config-plugins');

/**
 * Expo config plugin — adds FLAG_SECURE to MainActivity.kt.
 * Prevents screenshots and screen recording app-wide (financial data protection).
 */
module.exports = function withFlagSecure(config) {
  return withMainActivity(config, (mod) => {
    const { modResults, modRequest: { language } } = mod;

    if (language !== 'kt') return mod;

    let contents = modResults.contents;

    // Skip if already patched
    if (contents.includes('FLAG_SECURE')) return mod;

    // Add import after 'import android.os.Bundle'
    contents = contents.replace(
      'import android.os.Bundle',
      'import android.os.Bundle\nimport android.view.WindowManager'
    );

    // Add setFlags call after super.onCreate(null)
    contents = contents.replace(
      'super.onCreate(null)',
      'super.onCreate(null)\n    // Block screenshots and screen recording (financial data protection)\n    window.setFlags(\n      WindowManager.LayoutParams.FLAG_SECURE,\n      WindowManager.LayoutParams.FLAG_SECURE\n    )'
    );

    modResults.contents = contents;
    return mod;
  });
};
