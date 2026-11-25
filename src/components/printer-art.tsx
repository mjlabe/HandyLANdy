import { Image } from 'expo-image';

export function PrinterArt({ size = 180 }: { size?: number }) {
  return <Image source={require('../../assets/printer.svg')} contentFit="contain" style={{ width: size * 1.43, height: size }} accessibilityLabel="Illustration of an enclosed 3D printer" />;
}
