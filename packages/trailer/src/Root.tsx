import { Composition } from "remotion";
import { IkaTenseiTrailer } from "./Trailer";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="IkaTenseiTrailer"
        component={IkaTenseiTrailer}
        durationInFrames={1350} // 45 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
