import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexFile = path.join(__dirname, "image-index.json");
const outputDir = path.join(__dirname, "data");

const images = JSON.parse(await readFile(indexFile, "utf8"));

await mkdir(outputDir, { recursive: true });

for (const [index, image] of images.entries()) {
  const fileNumber = String(index + 1).padStart(2, "0");
  const outputPath = path.join(outputDir, `${fileNumber}.jpg`);

  console.log(`Downloading ${fileNumber}.jpg - ${image.name}`);

  const imageResponse = await fetch(image.url);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download ${image.url}: ${imageResponse.status} ${imageResponse.statusText}`);
  }

  const arrayBuffer = await imageResponse.arrayBuffer();
  await writeFile(outputPath, Buffer.from(arrayBuffer));
}

console.log("Done.");
