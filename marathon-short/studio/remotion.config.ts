import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Enable WebGL rendering with SwiftShader/ANGLE fallback if needed
Config.setChromiumOpenGlRenderer("angle");
