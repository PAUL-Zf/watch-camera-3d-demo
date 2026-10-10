// Fit the sensor image into its available cell without changing its 4:3
// projection. The surrounding card can grow in either dimension.
export function fitSensorViewport(width, height) {
  // Integer width keeps style serialization stable between animation frames.
  const w = Math.floor(Math.max(0, Math.min(width, height * 4 / 3)));
  return { width: w, height: w * 3 / 4 };
}
