export function createRightEdgeFillMask(sourceMask, width, height, orientation = "right") {
  if (!width || !height) {
    return null;
  }

  const output = new ImageData(width, height);
  const pixels = output.data;

  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index + 3] = 255;
  }

  if (!sourceMask) {
    output.meta = {
      orientation,
      dividerX: Math.floor(width / 2),
      sourceSide: orientation === "left" ? "right" : "left",
      mirrorSide: orientation === "left" ? "left" : "right",
      sourceBoundaryX: null,
      mirrorBoundaryX: null,
    };
    return output;
  }

  const sourcePixels = sourceMask.data;
  let leftMostFilledX = width;
  let rightMostFilledX = -1;

  for (let pixelIndex = 0; pixelIndex < sourcePixels.length; pixelIndex += 4) {
    const value = sourcePixels[pixelIndex];

    pixels[pixelIndex] = value;
    pixels[pixelIndex + 1] = value;
    pixels[pixelIndex + 2] = value;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = (y * width + x) * 4;

      if (sourcePixels[sourceIndex] === 255) {
        leftMostFilledX = Math.min(leftMostFilledX, x);
        break;
      }
    }

    for (let x = width - 1; x >= 0; x -= 1) {
      const sourceIndex = (y * width + x) * 4;

      if (sourcePixels[sourceIndex] === 255) {
        rightMostFilledX = Math.max(rightMostFilledX, x);
        break;
      }
    }
  }

  if (rightMostFilledX < 0 || leftMostFilledX >= width) {
    output.meta = {
      orientation,
      dividerX: Math.floor(width / 2),
      sourceSide: orientation === "left" ? "right" : "left",
      mirrorSide: orientation === "left" ? "left" : "right",
      sourceBoundaryX: null,
      mirrorBoundaryX: null,
    };
    return output;
  }

  if (orientation === "left") {
    fillLeftSide(pixels, sourcePixels, width, height, leftMostFilledX);
    output.meta = {
      orientation,
      dividerX: leftMostFilledX,
      sourceSide: "right",
      mirrorSide: "left",
      sourceBoundaryX: leftMostFilledX,
      mirrorBoundaryX: Math.max(0, leftMostFilledX - 1),
    };
    return output;
  }

  fillRightSide(pixels, sourcePixels, width, height, rightMostFilledX);
  output.meta = {
    orientation,
    dividerX: rightMostFilledX,
    sourceSide: "left",
    mirrorSide: "right",
    sourceBoundaryX: rightMostFilledX,
    mirrorBoundaryX: Math.min(width - 1, rightMostFilledX + 1),
  };

  return output;
}

function fillRightSide(pixels, sourcePixels, width, height, rightMostFilledX) {
  for (let y = 0; y < height; y += 1) {
    for (let x = rightMostFilledX + 1; x < width; x += 1) {
      const targetIndex = (y * width + x) * 4;

      pixels[targetIndex] = 255;
      pixels[targetIndex + 1] = 255;
      pixels[targetIndex + 2] = 255;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x <= rightMostFilledX; x += 1) {
      const sourceIndex = (y * width + x) * 4;

      if (sourcePixels[sourceIndex] !== 255) {
        continue;
      }

      const mirroredX = rightMostFilledX + (rightMostFilledX - x) + 1;

      if (mirroredX >= width) {
        continue;
      }

      const targetIndex = (y * width + mirroredX) * 4;

      pixels[targetIndex] = 0;
      pixels[targetIndex + 1] = 0;
      pixels[targetIndex + 2] = 0;
    }
  }
}

function fillLeftSide(pixels, sourcePixels, width, height, leftMostFilledX) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < leftMostFilledX; x += 1) {
      const targetIndex = (y * width + x) * 4;

      pixels[targetIndex] = 255;
      pixels[targetIndex + 1] = 255;
      pixels[targetIndex + 2] = 255;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = leftMostFilledX; x < width; x += 1) {
      const sourceIndex = (y * width + x) * 4;

      if (sourcePixels[sourceIndex] !== 255) {
        continue;
      }

      const mirroredX = leftMostFilledX - (x - leftMostFilledX) - 1;

      if (mirroredX < 0) {
        continue;
      }

      const targetIndex = (y * width + mirroredX) * 4;

      pixels[targetIndex] = 0;
      pixels[targetIndex + 1] = 0;
      pixels[targetIndex + 2] = 0;
    }
  }
}
