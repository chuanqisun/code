export function invertImageData(sourceImageData) {
  if (!sourceImageData) {
    return null;
  }

  const { width, height, data } = sourceImageData;
  const output = new ImageData(width, height);
  const outputPixels = output.data;

  for (let index = 0; index < data.length; index += 4) {
    outputPixels[index] = 255 - data[index];
    outputPixels[index + 1] = 255 - data[index + 1];
    outputPixels[index + 2] = 255 - data[index + 2];
    outputPixels[index + 3] = data[index + 3];
  }

  return output;
}
