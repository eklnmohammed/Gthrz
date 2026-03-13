#!/usr/bin/env node
'use strict';

const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../assets/icon.svg');
const svg = fs.readFileSync(svgPath, 'utf8');

const sizes = [
  { name: 'icon.png', size: 1024 },
  { name: 'adaptive-icon.png', size: 1024 },
  { name: 'favicon.png', size: 48 },
];

for (const { name, size } of sizes) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  });
  const png = resvg.render().asPng();
  const outPath = path.join(__dirname, '../assets', name);
  fs.writeFileSync(outPath, png);
  console.log(`✓ ${name} (${size}×${size})`);
}
