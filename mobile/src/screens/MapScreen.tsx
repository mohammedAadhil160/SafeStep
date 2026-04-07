/**
 * SafeStep — Map Screen (Main Screen)
 * Real-time safety map with route overlays, glassmorphism dashboard, and SOS
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  StatusBar,
  Animated,
} from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import LinearGradient from 'react-native-linear-gradient';

import { useStore } from '../store/useStore';
import { SafetyDashboard } from '../components/SafetyDashboard';
import { SOSButton } from '../components/SOSButton';
import { Colors, Spacing, Radius, Typography } from '../theme/tokens';

// Dark map style for premium look
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9090b0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a1a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a1a35' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#12122a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1a35' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#22223d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2d2d55' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#050510' }] },
];

const INITIAL_REGION = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.025,
  longitudeDelta: 0.025,
};

export const MapScreen: React.FC = () => {
  const mapRef = useRef<MapView>(null);
  const headerOpacity = useRef(new Animated.Value(1)).current;

  const {
    userLocation,
    currentAnalysis,
    isAnalyzing,
    activeRoute,
    isSosActive,
    dashboardExpanded,
    mapMode,
    startWatchingLocation,
    stopWatchingLocation,
    analyzeTappedLocation,
    setDashboardExpanded,
    setMapMode,
    triggerSOS,
    clearRoute,
  } = useStore();

  useEffect(() => {
    startWatchingLocation();
    return () => stopWatchingLocation();
  }, []);

  // Center map on user location when obtained
  useEffect(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 800);
    }
  }, [userLocation?.latitude]);

  const handleMapPress = useCallback((e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    analyzeTappedLocation(latitude, longitude);
  }, [analyzeTappedLocation]);

  const handleSOS = useCallback(() => {
    triggerSOS('anonymous_user');
  }, [triggerSOS]);

  const riskColor = currentAnalysis?.color_code ?? Colors.primary;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Map ───────────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        customMapStyle={DARK_MAP_STYLE}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        onPress={handleMapPress}
      >
        {/* Route Polylines (colored by segment safety) */}
        {activeRoute?.segments.map((segment, idx) => (
          <Polyline
            key={idx}
            coordinates={segment.waypoints.map(w => ({
              latitude: w.lat,
              longitude: w.lng,
            }))}
            strokeColor={segment.color_code}
            strokeWidth={6}
            lineDashPattern={segment.safety_score < 5 ? [8, 4] : undefined}
            zIndex={10}
          />
        ))}

        {/* Safety Zone Circle (around tapped point) */}
        {currentAnalysis && (
          <Circle
            center={{ latitude: currentAnalysis.lat, longitude: currentAnalysis.lng }}
            radius={200}
            fillColor={`${riskColor}18`}
            strokeColor={`${riskColor}60`}
            strokeWidth={2}
            zIndex={5}
          />
        )}

        {/* Incident Markers */}
        {currentAnalysis?.nearby_incidents.map(incident => (
          <Marker
            key={incident.id}
            coordinate={{
              latitude: currentAnalysis.lat + (Math.random() - 0.5) * 0.003,
              longitude: currentAnalysis.lng + (Math.random() - 0.5) * 0.003,
            }}
            title={incident.incident_type.replace(/_/g, ' ')}
            description={`Severity: ${incident.severity}/10 · ${Math.round(incident.distance_m)}m`}
            pinColor={Colors.danger}
          />
        ))}
      </MapView>

      {/* ── Top Header Bar ────────────────────────────────────────────────── */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <LinearGradient
          colors={['rgba(10,10,26,0.95)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.appName}>SafeStep</Text>
            <Text style={styles.headerSub}>
              {mapMode === 'navigate' ? '🧭 Navigating...' :
               mapMode === 'report'   ? '📍 Report Mode' :
               '🔍 Tap map to analyze'}
            </Text>
          </View>

          {/* Mode Toggle Chips */}
          <View style={styles.modeChips}>
            {(['explore', 'navigate', 'report'] as const).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[styles.chip, mapMode === mode && styles.chipActive]}
                onPress={() => setMapMode(mode)}
              >
                <Text style={[styles.chipText, mapMode === mode && styles.chipTextActive]}>
                  {mode === 'explore' ? '🔍' : mode === 'navigate' ? '🧭' : '⚠️'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.View>

      {/* ── Locate Me Button ──────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.locateBtn}
        onPress={() => {
          if (userLocation && mapRef.current) {
            mapRef.current.animateToRegion({
              ...userLocation,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            }, 600);
          }
        }}
      >
        <LinearGradient colors={['#1A1A35', '#12122A']} style={styles.locateBtnGradient}>
          <Text style={styles.locateBtnIcon}>📍</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Clear Route Button ────────────────────────────────────────────── */}
      {activeRoute && (
        <TouchableOpacity style={styles.clearRouteBtn} onPress={clearRoute}>
          <LinearGradient colors={['#1A1A35', '#12122A']} style={styles.locateBtnGradient}>
            <Text style={styles.locateBtnIcon}>✕</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* ── Safety Dashboard Overlay ──────────────────────────────────────── */}
      <SafetyDashboard
        analysis={currentAnalysis}
        isAnalyzing={isAnalyzing}
        isExpanded={dashboardExpanded}
        onToggle={() => setDashboardExpanded(!dashboardExpanded)}
        onReport={() => setMapMode('report')}
      />

      {/* ── SOS Button ────────────────────────────────────────────────────── */}
      <SOSButton onTrigger={handleSOS} isActive={isSosActive} />

      {/* ── Route Stats Bar (when navigating) ────────────────────────────── */}
      {activeRoute && (
        <View style={styles.routeStats}>
          <LinearGradient
            colors={['rgba(12,12,28,0.97)', 'rgba(10,10,26,0.99)']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.routeStatItem}>
            <Text style={styles.routeStatValue}>
              {(activeRoute.total_distance_m / 1000).toFixed(1)} km
            </Text>
            <Text style={styles.routeStatLabel}>Distance</Text>
          </View>
          <View style={styles.routeStatDivider} />
          <View style={styles.routeStatItem}>
            <Text style={styles.routeStatValue}>{activeRoute.estimated_time_min} min</Text>
            <Text style={styles.routeStatLabel}>Est. Time</Text>
          </View>
          <View style={styles.routeStatDivider} />
          <View style={styles.routeStatItem}>
            <Text style={[styles.routeStatValue, { color: activeRoute.color_code }]}>
              {activeRoute.overall_safety_score.toFixed(1)}
            </Text>
            <Text style={styles.routeStatLabel}>Safety Score</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: Spacing.md,
    zIndex: 50,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appName: {
    fontSize: Typography.xl,
    fontWeight: Typography.black,
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modeChips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgGlass,
    borderWidth: 1,
    borderColor: Colors.bgGlassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: { fontSize: 16 },
  chipTextActive: {},

  locateBtn: {
    position: 'absolute',
    top: 120,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    overflow: 'hidden',
    zIndex: 50,
    borderWidth: 1,
    borderColor: Colors.bgGlassBorder,
  },
  clearRouteBtn: {
    position: 'absolute',
    top: 175,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    overflow: 'hidden',
    zIndex: 50,
    borderWidth: 1,
    borderColor: Colors.bgGlassBorder,
  },
  locateBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locateBtnIcon: { fontSize: 20 },

  routeStats: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    paddingBottom: 28,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: Colors.bgGlassBorder,
    zIndex: 10,
  },
  routeStatItem: { alignItems: 'center' },
  routeStatValue: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  routeStatLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  routeStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.bgGlassBorder,
  },
});
