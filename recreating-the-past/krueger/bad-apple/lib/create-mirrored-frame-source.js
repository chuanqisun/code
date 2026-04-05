export function createMirroredFrameSource(source, canvas) {
  const ctx = canvas.getContext("2d");

  if (!ctx || !source.videoWidth || !source.videoHeight) {
    return null;
  }

  if (canvas.width !== source.videoWidth || canvas.height !== source.videoHeight) {
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(-1, 0, 0, 1, canvas.width, 0);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  return canvas;
}
