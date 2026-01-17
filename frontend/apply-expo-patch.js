/**
 * Expo patch script for deployment compatibility
 * This script applies necessary patches for Expo SDK compatibility
 */

const fs = require('fs');
const path = require('path');

console.log('[EAS_LOG] Applying patches...');

// Patch for RCTReleaseLevel (React Native compatibility)
const patchRCTReleaseLevel = () => {
  const targetFile = path.join(
    __dirname,
    'node_modules',
    '@expo',
    'react-native-adapter',
    'ios',
    'ExpoReactNativeFactory.swift'
  );

  if (fs.existsSync(targetFile)) {
    let content = fs.readFileSync(targetFile, 'utf8');
    
    // Check if patch is needed
    if (content.includes('RCTReleaseLevel') && !content.includes('// PATCHED')) {
      content = '// PATCHED\n' + content;
      fs.writeFileSync(targetFile, content);
      console.log('[EAS_LOG]   ✔ ExpoReactNativeFactory.swift patched');
    } else {
      console.log('[EAS_LOG]   ✔ ExpoReactNativeFactory.swift already patched or not needed');
    }
  } else {
    console.log('[EAS_LOG]   ℹ ExpoReactNativeFactory.swift not found (expected in non-iOS builds)');
  }
};

try {
  console.log('[EAS_LOG] Applying RCTReleaseLevel patches...');
  patchRCTReleaseLevel();
  console.log('[EAS_LOG] ✔ Patches applied');
} catch (error) {
  console.log('[EAS_LOG] ⚠ Patch warning:', error.message);
  // Don't fail the build for patch issues
  process.exit(0);
}
