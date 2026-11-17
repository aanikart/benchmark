import { Component } from "react";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { CandidateRoute, Place } from "../../shared/contracts";
import { placeLabel } from "../features/planner/viewModel";
import { colors, radius, space, type } from "../theme/tokens";

/** If the native map fails, the list, ribbon and steps stay usable. */
class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <View style={[styles.map, styles.fallback]}>
          <Text style={styles.fallbackText}>The map couldn't be shown. The steps below have everything you need.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

/** Supplementary map: every stop here is also in the ordered list below it. */
export function RouteMap({
  candidate, placesById, countedByPlace, onStopPress,
}: {
  candidate: CandidateRoute;
  placesById: ReadonlyMap<string, Place>;
  countedByPlace: ReadonlyMap<string, boolean>;
  onStopPress: (placeId: string) => void;
}) {
  const coords = candidate.route.coordinates.map(([longitude, latitude]) => ({ latitude, longitude }));
  const lats = coords.map((c) => c.latitude);
  const lons = coords.map((c) => c.longitude);
  const region = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
    latitudeDelta: Math.max(0.002, (Math.max(...lats) - Math.min(...lats)) * 1.6),
    longitudeDelta: Math.max(0.002, (Math.max(...lons) - Math.min(...lons)) * 1.6),
  };
  return (
    <MapBoundary>
      <MapView
        style={styles.map}
        initialRegion={region}
        key={candidate.id}
        accessibilityLabel="Map of this route. All stops are also listed below."
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <Polyline coordinates={coords} strokeColor={colors.accent} strokeWidth={4} />
        <Marker coordinate={coords[0]} title="Start" pinColor={colors.text} />
        <Marker coordinate={coords[coords.length - 1]} title="Destination" pinColor={colors.text} />
        {candidate.stopPlaceIds.map((id) => {
          const p = placesById.get(id);
          if (!p) return null;
          const [longitude, latitude] = p.displayCoordinate;
          return (
            <Marker
              key={id}
              coordinate={{ latitude, longitude }}
              title={placeLabel(p)}
              description={countedByPlace.get(id) ? "Planned rest" : "Not counted as a rest"}
              pinColor={countedByPlace.get(id) ? "green" : "orange"}
              onCalloutPress={() => onStopPress(id)}
            />
          );
        })}
      </MapView>
    </MapBoundary>
  );
}

const styles = StyleSheet.create({
  map: { height: 200, borderRadius: radius - 4, overflow: "hidden" },
  fallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas, padding: space.lg },
  fallbackText: { fontSize: type.support, color: colors.secondary, textAlign: "center" },
});
