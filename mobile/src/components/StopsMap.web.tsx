/**
 * Web stand-in for StopsMap — react-native-maps is native-only, and Metro
 * must not pull it into the web bundle. Keep the prop surface identical to
 * StopsMap.tsx.
 */
export type MapStop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
};

type Props = {
  stops: MapStop[];
  connected?: boolean;
  showsUserLocation?: boolean;
  height?: number;
};

export function StopsMap(_props: Props) {
  return null;
}
