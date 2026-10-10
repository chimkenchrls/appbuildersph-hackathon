// Renders chosen frames as PNGs for checking: node scripts/stills.mjs 60 300 915 ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const frames = process.argv.slice(2).map(Number);
const browserExecutable = process.env.REMOTION_BROWSER || undefined;
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), enableRspack: true });
const composition = await selectComposition({ serveUrl, id: "OwlSetFilm", browserExecutable });
for (const frame of frames) {
  const output = path.resolve(`out/stills/f${String(frame).padStart(4, "0")}.jpg`);
  await renderStill({ composition, serveUrl, frame, output, imageFormat: "jpeg", jpegQuality: 82, browserExecutable, scale: 0.5 });
  console.log(output);
}
