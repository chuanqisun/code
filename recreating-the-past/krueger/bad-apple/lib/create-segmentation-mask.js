export function createSegmentationMask(confidenceMask, width, height) {
  if (!width || !height) {
    return null;
  }

  const output = new ImageData(width, height);
  const pixels = output.data;

  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index + 3] = 255;
  }

  if (!confidenceMask) {
    for (let index = 0; index < pixels.length; index += 4) {
      pixels[index] = 0;
      pixels[index + 1] = 0;
      pixels[index + 2] = 0;
    }

    return output;
  }

  const mask = confidenceMask.getAsFloat32Array();

  for (let pixelIndex = 0; pixelIndex < mask.length; pixelIndex += 1) {
    const intensity = Math.max(0, Math.min(255, Math.round(mask[pixelIndex] * 255)));
    const targetIndex = pixelIndex * 4;

    pixels[targetIndex] = intensity;
    pixels[targetIndex + 1] = intensity;
    pixels[targetIndex + 2] = intensity;
  }

  return output;
}
