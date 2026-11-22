import React from "react";
import { Composition } from "remotion";
import { MarathonShort } from "./videos/marathon/Marathon";
import { FPS as MARATHON_FPS, TOTAL_FRAMES as MARATHON_FRAMES } from "./videos/marathon/story";
import { WhaleShort } from "./videos/whale/Whale";
import { WHALE_FPS, WHALE_TOTAL_FRAMES } from "./videos/whale/whaleStory";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MarathonShort"
        component={MarathonShort}
        durationInFrames={MARATHON_FRAMES}
        fps={MARATHON_FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="WhaleShort"
        component={WhaleShort}
        durationInFrames={WHALE_TOTAL_FRAMES}
        fps={WHALE_FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
