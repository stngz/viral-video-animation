import React from "react";
import { Composition } from "remotion";
import { MarathonShort } from "./videos/marathon/Marathon";
import { FPS, TOTAL_FRAMES } from "./videos/marathon/story";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MarathonShort"
      component={MarathonShort}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
    />
  );
};
