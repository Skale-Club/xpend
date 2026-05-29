const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const svgPath = path.join(root, "src", "app", "icon.svg");
const iconsDir = path.join(root, "public", "icons");
const publicDir = path.join(root, "public");

// No "maskable" purpose: the logo must always render in full, never cropped.
const pngTargets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180, flatten: "#30568C" },
];

const icoSizes = [16, 32, 48];

function buildIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(count * 16);
  let offset = 6 + count * 16;
  images.forEach((img, i) => {
    const b = i * 16;
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b); // width
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b + 1); // height
    dir.writeUInt8(0, b + 2); // palette colors
    dir.writeUInt8(0, b + 3); // reserved
    dir.writeUInt16LE(1, b + 4); // color planes
    dir.writeUInt16LE(32, b + 6); // bits per pixel
    dir.writeUInt32LE(img.buffer.length, b + 8); // image size
    dir.writeUInt32LE(offset, b + 12); // image offset
    offset += img.buffer.length;
  });

  return Buffer.concat([header, dir, ...images.map((i) => i.buffer)]);
}

async function main() {
  if (!fs.existsSync(svgPath)) {
    throw new Error(`Source SVG not found: ${svgPath}`);
  }
  fs.mkdirSync(iconsDir, { recursive: true });

  const svg = fs.readFileSync(svgPath);

  for (const { file, size, flatten } of pngTargets) {
    let pipeline = sharp(svg, { density: 384 }).resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    if (flatten) {
      pipeline = pipeline.flatten({ background: flatten });
    }
    await pipeline.png().toFile(path.join(iconsDir, file));
    console.log(`generated icons/${file} (${size}x${size})`);
  }

  const icoImages = [];
  for (const size of icoSizes) {
    const buffer = await sharp(svg, { density: 384 })
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    icoImages.push({ size, buffer });
  }
  fs.writeFileSync(path.join(publicDir, "favicon.ico"), buildIco(icoImages));
  console.log(`generated favicon.ico (${icoSizes.join(", ")})`);

  // Remove any stale maskable icon from previous runs.
  const staleMaskable = path.join(iconsDir, "icon-maskable-512.png");
  if (fs.existsSync(staleMaskable)) {
    fs.rmSync(staleMaskable);
    console.log("removed stale icons/icon-maskable-512.png");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
