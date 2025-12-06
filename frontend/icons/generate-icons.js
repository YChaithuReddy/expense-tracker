// Run this script with: node generate-icons.js
// Or just open generate-icons.html in browser and download icons

const fs = require('fs');
const { createCanvas } = require('canvas');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

function drawIcon(ctx, size) {
    // Background gradient (teal)
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#14b8a6');
    gradient.addColorStop(1, '#0d9488');

    // Rounded rectangle background
    const radius = size * 0.15;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Wallet shape
    const walletWidth = size * 0.7;
    const walletHeight = size * 0.45;
    const walletX = (size - walletWidth) / 2;
    const walletY = size * 0.32;
    const walletRadius = size * 0.05;

    ctx.beginPath();
    ctx.roundRect(walletX, walletY, walletWidth, walletHeight, walletRadius);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();

    // Wallet top bar
    ctx.beginPath();
    ctx.roundRect(walletX, walletY, walletWidth, walletHeight * 0.3, [walletRadius, walletRadius, 0, 0]);
    ctx.fillStyle = '#0f766e';
    ctx.fill();

    // Rupee symbol
    ctx.font = `bold ${size * 0.28}px Arial`;
    ctx.fillStyle = '#0d9488';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('₹', size / 2, walletY + walletHeight * 0.65);

    // Coin
    const coinRadius = size * 0.1;
    const coinX = size * 0.75;
    const coinY = size * 0.25;

    const coinGradient = ctx.createLinearGradient(
        coinX - coinRadius, coinY - coinRadius,
        coinX + coinRadius, coinY + coinRadius
    );
    coinGradient.addColorStop(0, '#fcd34d');
    coinGradient.addColorStop(1, '#f59e0b');

    ctx.beginPath();
    ctx.arc(coinX, coinY, coinRadius, 0, Math.PI * 2);
    ctx.fillStyle = coinGradient;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = size * 0.01;
    ctx.stroke();

    // Rupee on coin
    ctx.font = `bold ${size * 0.09}px Arial`;
    ctx.fillStyle = 'white';
    ctx.fillText('₹', coinX, coinY);
}

console.log('Generating PWA icons...');
console.log('Note: This requires the "canvas" npm package.');
console.log('Install with: npm install canvas');
console.log('');
console.log('Alternatively, open generate-icons.html in your browser to download icons.');

try {
    sizes.forEach(size => {
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        drawIcon(ctx, size);

        const buffer = canvas.toBuffer('image/png');
        const filename = `icon-${size}x${size}.png`;
        fs.writeFileSync(filename, buffer);
        console.log(`✅ Created ${filename}`);
    });
    console.log('\\nAll icons generated successfully!');
} catch (error) {
    console.log('Canvas module not installed. Use browser method instead:');
    console.log('1. Open frontend/generate-icons.html in Chrome');
    console.log('2. Click "Generate & Download All Icons"');
    console.log('3. Move downloaded files to frontend/icons/');
}
