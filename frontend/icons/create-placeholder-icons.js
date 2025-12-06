// Simple script to create placeholder icons
// Run with: node create-placeholder-icons.js

const fs = require('fs');
const path = require('path');

// Simple 1x1 teal pixel PNG as base
// We'll use SVG for now which works for PWA

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const svgTemplate = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#14b8a6"/>
      <stop offset="100%" style="stop-color:#0d9488"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="77" fill="url(#bg)"/>
  <rect x="100" y="164" width="312" height="200" rx="24" fill="#fff" opacity=".95"/>
  <rect x="100" y="164" width="312" height="60" rx="24" fill="#0f766e"/>
  <text x="256" y="315" font-family="Arial" font-size="120" font-weight="bold" fill="#0d9488" text-anchor="middle">₹</text>
  <circle cx="380" cy="140" r="45" fill="#f59e0b"/>
  <text x="380" y="155" font-family="Arial" font-size="40" font-weight="bold" fill="#fff" text-anchor="middle">₹</text>
</svg>`;

console.log('Creating SVG icons (compatible with modern PWAs)...\n');

sizes.forEach(size => {
    const svg = svgTemplate(size);
    const filename = path.join(__dirname, `icon-${size}x${size}.svg`);
    fs.writeFileSync(filename, svg);
    console.log(`✅ Created icon-${size}x${size}.svg`);
});

console.log('\n📝 Note: For best results, convert these SVGs to PNGs using:');
console.log('   - Online tool: https://svgtopng.com/');
console.log('   - Or open generate-icons.html in browser');
console.log('\nSVG icons work for development, but PNGs are recommended for production.');
