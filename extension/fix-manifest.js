#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix manifest after build
const manifestPath = path.join(__dirname, 'dist', 'manifest.json');

try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Remove icons section
  delete manifest.icons;

  // Remove type: module from background
  if (manifest.background && manifest.background.type === 'module') {
    delete manifest.background.type;
  }

  // Write fixed manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('✅ Manifest fixed successfully');
} catch (error) {
  console.error('❌ Error fixing manifest:', error);
  process.exit(1);
}