import { Image } from "react-native";

interface WhisLogoProps {
  size?: number;
  color?: string;
}

export function WhisLogo({ size = 64 }: WhisLogoProps) {
  return (
    <Image
      source={require("../../../assets/images/icon.png")}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.18),
      }}
      resizeMode="contain"
    />
  );
}

// Re-export as PaseoLogo for internal symbol compatibility
export const PaseoLogo = WhisLogo;
