import { useMemo } from "react";
import { Image, type ImageStyle } from "react-native";

interface WhisLogoProps {
  size?: number;
  color?: string;
}

export function WhisLogo({ size = 64 }: WhisLogoProps) {
  const imageStyle = useMemo<ImageStyle>(
    () => ({
      width: size,
      height: size,
      borderRadius: Math.round(size * 0.18),
    }),
    [size],
  );

  return (
    <Image
      source={require("../../../assets/images/icon.png")}
      style={imageStyle}
      resizeMode="contain"
    />
  );
}

// Re-export as PaseoLogo for internal symbol compatibility
export const PaseoLogo = WhisLogo;
