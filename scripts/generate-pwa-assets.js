import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const sourceImage = path.join(publicDir, 'applogo.jpg');
const iconsDir = path.join(publicDir, 'icons');
const splashDir = path.join(publicDir, 'splash');

// Ensure directories exist
[iconsDir, splashDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function generateAssets() {
  try {
    console.log('Generating PWA assets from applogo.jpg...\n');

    // Generate icons
    const iconSizes = [96, 192, 512];
    for (const size of iconSizes) {
      // Regular icon (square)
      await sharp(sourceImage)
        .resize(size, size, { fit: 'cover', background: { r: 255, g: 255, b: 255 } })
        .png()
        .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
      console.log(`✓ Generated icon-${size}x${size}.png`);

      // Maskable icon (for adaptive display on devices with custom icon shapes)
      await sharp(sourceImage)
        .resize(Math.floor(size * 0.8), Math.floor(size * 0.8), { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
        .png()
        .toFile(path.join(iconsDir, `icon-${size}x${size}-maskable.png`));
      console.log(`✓ Generated icon-${size}x${size}-maskable.png`);
    }

    // Generate splash screens
    const splashSizes = [
      { width: 192, height: 192, name: '192x192' },
      { width: 512, height: 512, name: '512x512' },
    ];

    for (const splash of splashSizes) {
      // Create splash screen with gradient background
      const svgOverlay = `
        <svg width="${splash.width}" height="${splash.height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#fec449;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#f5f5f5;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="${splash.width}" height="${splash.height}" fill="url(#grad)"/>
        </svg>
      `;

      await sharp(Buffer.from(svgOverlay))
        .png()
        .toFile(path.join(splashDir, `splash-${splash.name}.png`));

      console.log(`✓ Generated splash-${splash.name}.png`);
    }

    console.log('\n✅ All PWA assets generated successfully!');
  } catch (error) {
    console.error('❌ Error generating assets:', error.message);
    process.exit(1);
  }
}

generateAssets();
