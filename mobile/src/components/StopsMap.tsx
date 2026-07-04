import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  Marker,
  UserLocation,
  type InitialViewState,
} from '@maplibre/maplibre-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radii, spacing } from '@/lib/theme';

// OpenFreeMap: keyless, no billing, production use allowed. OSM's Tunisia
// coverage is what makes this viable — to change the look swap the style,
// not the provider (also: /styles/positron, /styles/bright).
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export type MapStop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** shown after the name in the tap label, e.g. "450 m" or "+12 min" */
  description?: string;
};

type Props = {
  stops: MapStop[];
  /** draw the route through the stops in array order (line detail) */
  connected?: boolean;
  showsUserLocation?: boolean;
  height?: number;
};

/** Initial camera framing every stop ([lng, lat] world, per GeoJSON). */
function viewFor(stops: MapStop[]): InitialViewState {
  if (stops.length === 1) {
    return { center: [stops[0].longitude, stops[0].latitude], zoom: 14 };
  }
  const lats = stops.map((s) => s.latitude);
  const lngs = stops.map((s) => s.longitude);
  return {
    bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
    padding: { top: 40, right: 40, bottom: 40, left: 40 },
  };
}

/**
 * Map of stops on MapLibre + OpenFreeMap tiles (no API key, no Google
 * billing). Tapping a marker names it in an overlay bar — v11 dropped the
 * old always-on callouts. Web gets the StopsMap.web.tsx placeholder instead;
 * the native module never enters that bundle.
 */
export function StopsMap({
  stops,
  connected = false,
  showsUserLocation = false,
  height = 240,
}: Props) {
  const [selected, setSelected] = useState<MapStop | null>(null);
  const initialViewState = useMemo(() => (stops.length ? viewFor(stops) : null), [stops]);

  const routeShape = useMemo(
    () =>
      ({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: stops.map((s) => [s.longitude, s.latitude]),
        },
      }) as const,
    [stops],
  );

  if (!initialViewState) return null;

  return (
    <View style={[styles.frame, { height }]}>
      <MapLibreMap style={StyleSheet.absoluteFill} mapStyle={STYLE_URL} attribution>
        <Camera initialViewState={initialViewState} />
        {showsUserLocation && <UserLocation />}
        {connected && stops.length > 1 && (
          <GeoJSONSource id="route" data={routeShape}>
            <Layer
              id="route-line"
              type="line"
              paint={{ 'line-color': colors.primary, 'line-width': 3 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        )}
        {stops.map((s) => (
          <Marker
            key={s.id}
            lngLat={[s.longitude, s.latitude]}
            onPress={() => setSelected((prev) => (prev?.id === s.id ? null : s))}
          >
            <View style={[styles.marker, selected?.id === s.id && styles.markerSelected]} />
          </Marker>
        ))}
      </MapLibreMap>
      {selected && (
        <Pressable style={styles.label} onPress={() => setSelected(null)}>
          <Text style={styles.labelName} numberOfLines={1}>
            {selected.name}
          </Text>
          {selected.description && <Text style={styles.labelDetail}>{selected.description}</Text>}
        </Pressable>
      )}
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
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 2.5,
    borderColor: colors.onPrimary,
    elevation: 2,
  },
  markerSelected: {
    backgroundColor: colors.text,
  },
  label: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  labelName: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  labelDetail: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
