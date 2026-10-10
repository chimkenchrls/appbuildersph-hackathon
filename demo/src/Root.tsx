import { loadFont } from "@remotion/fonts";
import { Composition, staticFile } from "remotion";
import { OwlSetFilm } from "./Film";
import { FPS, H, TOTAL, W } from "./lib";

// The site's own variable fonts (weights 100 to 900), from public/fonts.
loadFont({ family: "Geist", url: staticFile("fonts/Geist-Variable.woff2"), weight: "100 900" });
loadFont({ family: "Geist Mono", url: staticFile("fonts/GeistMono-Variable.woff2"), weight: "100 900" });

export const RemotionRoot: React.FC = () => {
  return (
    <Composition id="OwlSetFilm" component={OwlSetFilm} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
  );
};
