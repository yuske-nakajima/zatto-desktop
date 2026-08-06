import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const sourceIcon = path.resolve("assets/brand/zatto-desktop-master.png");
const outputDirectory = path.resolve("assets/icons");
const outputBase = path.join(outputDirectory, "zatto-desktop");
const icnsSizes = [
  ["ic10", 1024],
  ["ic09", 512],
  ["ic08", 256],
  ["ic07", 128],
  ["icp6", 64],
  ["icp5", 32],
  ["icp4", 16],
];

function icnsChunk(type, image) {
  const header = Buffer.alloc(8);
  header.write(type, 0, 4, "ascii");
  header.writeUInt32BE(image.length + header.length, 4);
  return Buffer.concat([header, image]);
}

async function createIcns(temporaryDirectory) {
  const chunks = [];
  for (const [type, size] of icnsSizes) {
    const resizedPath = path.join(temporaryDirectory, `${size}.png`);
    await execFileAsync("magick", [
      sourceIcon,
      "-resize",
      `${size}x${size}`,
      resizedPath,
    ]);
    chunks.push(icnsChunk(type, await readFile(resizedPath)));
  }

  const header = Buffer.alloc(8);
  const body = Buffer.concat(chunks);
  header.write("icns", 0, 4, "ascii");
  header.writeUInt32BE(header.length + body.length, 4);
  await writeFile(`${outputBase}.icns`, Buffer.concat([header, body]));
}

async function main() {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "zatto-desktop-icons-"),
  );
  await mkdir(outputDirectory, { recursive: true });
  try {
    await execFileAsync("magick", [
      sourceIcon,
      "-resize",
      "512x512",
      `${outputBase}.png`,
    ]);
    await execFileAsync("magick", [
      sourceIcon,
      "-define",
      "icon:auto-resize=256,128,64,48,32,16",
      `${outputBase}.ico`,
    ]);
    await createIcns(temporaryDirectory);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

await main();
