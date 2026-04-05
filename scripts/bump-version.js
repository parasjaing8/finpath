#!/usr/bin/env node
/**
 * bump-version.js
 *
 * Increments versionCode by 1 and the semver patch by 1 in app.json.
 * Run before every Play Store upload:
 *
 *   npm run bump
 *
 * To bump a minor or major version instead, pass --minor or --major:
 *
 *   npm run bump -- --minor
 *   npm run bump -- --major
 */

'use strict';

const fs = require('fs');
const path = require('path');

const APP_JSON_PATH = path.join(__dirname, '..', 'app.json');

const raw = fs.readFileSync(APP_JSON_PATH, 'utf-8');
const appJson = JSON.parse(raw);

// --- versionCode (always +1) ---
const prevCode = appJson.expo.android.versionCode;
const newCode = prevCode + 1;
appJson.expo.android.versionCode = newCode;

// --- semver string ---
const args = process.argv.slice(2);
const bumpMinor = args.includes('--minor');
const bumpMajor = args.includes('--major');

const [major, minor, patch] = appJson.expo.version.split('.').map(Number);
let newVersion;
if (bumpMajor) {
  newVersion = `${major + 1}.0.0`;
} else if (bumpMinor) {
  newVersion = `${major}.${minor + 1}.0`;
} else {
  newVersion = `${major}.${minor}.${patch + 1}`;
}
appJson.expo.version = newVersion;

// Write back with consistent 2-space indent + trailing newline
fs.writeFileSync(APP_JSON_PATH, JSON.stringify(appJson, null, 2) + '\n');

console.log(
  `✅  Bumped: v${major}.${minor}.${patch} → v${newVersion}  |  versionCode ${prevCode} → ${newCode}`
);
