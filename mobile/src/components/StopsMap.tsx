import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { colors, radii } from '@/lib/theme';

export type MapStop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** marker callout second line, e.g. "450 m" or "+12 min" */
  description?: string;
};

type Props = {
  stops: MapStop[];
  /** draw the route through the stops in array order (line detail) */
  connected?: boolean;
  showsUserLocation?: boolean;
  height?: number;
};

/** Smallest region containing every stop, with breathing room. */
function regionFor(stops: MapStop[]) {
  const lats = stops.map((s) => s.latitude);
  const lngs = stops.map((s) => s.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.02),
  };
}

/**
 * Map of stops — Apple Maps on iOS, Google Maps on Android (API key comes
 * from the react-native-maps plugin in app.config.js). Web gets the
 * StopsMap.web.tsx placeholder instead; react-native-maps never enters that
 * bundle.
 */
export function StopsMap({
  stops,
  connected = false,
  showsUserLocation = false,
  height = 240,
}: Props) {
  const region = useMemo(() => (stops.length ? regionFor(stops) : null), [stops]);
  if (!region) return null;

  return (
    // Android's map view ignores borderRadius; clip it with a wrapper.
    <View style={[styles.frame, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsUserLocation={showsUserLocation}
      >
        {connected && stops.length > 1 && (
          <Polyline
            coordinates={stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude }))}
            strokeColor={colors.primary}
            strokeWidth={3}
          />
        )}
        {stops.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.latitude, longitude: s.longitude }}
            title={s.name}
            description={s.description}
            pinColor={colors.primary}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
