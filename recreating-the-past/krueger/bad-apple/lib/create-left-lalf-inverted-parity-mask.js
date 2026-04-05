export function createLeftHalfInvertedParityMask(sourceMask, width, height) {
  if (!width || !height) {
    return null;
  }

  const output = new ImageData(width, height);
  const pixels = output.data;

  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = 255;
    pixels[index + 1] = 255;
    pixels[index + 2] = 255;
    pixels[index + 3] = 255;
  }

  if (sourceMask) {
    const sourcePixels = sourceMask.data;
    const dividerLeftX = Math.floor(width / 2) - 1;
    const dividerCenterX = dividerLeftX + 0.5;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let overlapCount = 0;

        const originalIndex = (y * width + x) * 4;
        if (sourcePixels[originalIndex] === 255) {
          overlapCount += 1;
        }

        const mirroredSourceX = Math.round(2 * dividerCenterX - x);
        if (mirroredSourceX >= 0 && mirroredSourceX < width) {
          const mirroredIndex = (y * width + mirroredSourceX) * 4;
          if (sourcePixels[mirroredIndex] === 255) {
            overlapCount += 1;
          }
        }

        if (overlapCount % 2 === 1) {
          pixels[originalIndex] = 0;
          pixels[originalIndex + 1] = 0;
          pixels[originalIndex + 2] = 0;
        }
      }
    }
  }

  const leftHalfWidth = Math.floor(width / 2);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < leftHalfWidth; x += 1) {
      const index = (y * width + x) * 4;

      pixels[index] = 255 - pixels[index];
      pixels[index + 1] = 255 - pixels[index + 1];
      pixels[index + 2] = 255 - pixels[index + 2];
    }
  }

  return output;
}
