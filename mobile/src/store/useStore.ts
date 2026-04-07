/**
 * SafeStep — Global State Store (Zustand)
 * Manages location, safety analysis, route, and SOS state
 */

import { create } from 'zustand';
import { AnalyzeResponse, SafeRouteResponse, api } from '../services/api';
import Geolocation from '@react-native-community/geolocation';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface AppState {
  // Location
  userLocation: Coordinate | null;
  isLocating: boolean;
  locationError: string | null;

  // Safety Analysis
  currentAnalysis: AnalyzeResponse | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  lastAnalyzedAt: Date | null;

  // Route
  destination: Coordinate | null;
  activeRoute: SafeRouteResponse | null;
  isRoutingActive: boolean;

  // SOS
  isSosActive: boolean;
  sosTriggeredAt: Date | null;

  // UI
  dashboardExpanded: boolean;
  mapMode: 'explore' | 'navigate' | 'report';

  // Actions
  startWatchingLocation: () => void;
  stopWatchingLocation: () => void;
  analyzeCurrentLocation: () => Promise<void>;
  analyzeTappedLocation: (lat: number, lng: number) => Promise<void>;
  setDestination: (coord: Coordinate) => void;
  fetchRoute: () => Promise<void>;
  clearRoute: () => void;
  triggerSOS: (userId: string) => Promise<void>;
  setDashboardExpanded: (v: boolean) => void;
  setMapMode: (mode: 'explore' | 'navigate' | 'report') => void;
}

let _watcherId: number | null = null;

export const useStore = create<AppState>((set, get) => ({
  // ── Initial State ───────────────────────────────────────────────────────────
  userLocation: null,
  isLocating: false,
  locationError: null,
  currentAnalysis: null,
  isAnalyzing: false,
  analysisError: null,
  lastAnalyzedAt: null,
  destination: null,
  activeRoute: null,
  isRoutingActive: false,
  isSosActive: false,
  sosTriggeredAt: null,
  dashboardExpanded: false,
  mapMode: 'explore',

  // ── Location ────────────────────────────────────────────────────────────────
  startWatchingLocation: () => {
    set({ isLocating: true, locationError: null });

    _watcherId = Geolocation.watchPosition(
      position => {
        const coord: Coordinate = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        set({ userLocation: coord, isLocating: false });

        // Auto-analyze every time user moves > ~40m
        const prev = get().userLocation;
        if (!prev || haversine(prev, coord) > 40) {
          get().analyzeCurrentLocation();
        }
      },
      error => {
        set({ locationError: error.message, isLocating: false });
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 30,
        interval: 5000,
        fastestInterval: 3000,
      }
    );
  },

  stopWatchingLocation: () => {
    if (_watcherId !== null) {
      Geolocation.clearWatch(_watcherId);
      _watcherId = null;
    }
    set({ isLocating: false });
  },

  // ── Analysis ────────────────────────────────────────────────────────────────
  analyzeCurrentLocation: async () => {
    const loc = get().userLocation;
    if (!loc) return;
    await get().analyzeTappedLocation(loc.latitude, loc.longitude);
  },

  analyzeTappedLocation: async (lat: number, lng: number) => {
    set({ isAnalyzing: true, analysisError: null });
    try {
      const result = await api.analyzeLocation(lat, lng);
      set({
        currentAnalysis: result,
        isAnalyzing: false,
        lastAnalyzedAt: new Date(),
        dashboardExpanded: true,
      });
    } catch (err: any) {
      set({
        analysisError: err.message || 'Analysis failed',
        isAnalyzing: false,
      });
    }
  },

  // ── Route ───────────────────────────────────────────────────────────────────
  setDestination: (coord: Coordinate) => {
    set({ destination: coord, mapMode: 'navigate' });
    get().fetchRoute();
  },

  fetchRoute: async () => {
    const { userLocation, destination } = get();
    if (!userLocation || !destination) return;

    set({ isRoutingActive: true });
    try {
      const route = await api.getSafeRoute(
        userLocation.latitude,
        userLocation.longitude,
        destination.latitude,
        destination.longitude,
      );
      set({ activeRoute: route });
    } catch (err) {
      console.error('Route fetch failed:', err);
    } finally {
      set({ isRoutingActive: false });
    }
  },

  clearRoute: () => {
    set({ destination: null, activeRoute: null, mapMode: 'explore' });
  },

  // ── SOS ─────────────────────────────────────────────────────────────────────
  triggerSOS: async (userId: string) => {
    const loc = get().userLocation;
    if (!loc) return;

    set({ isSosActive: true, sosTriggeredAt: new Date() });
    try {
      await api.triggerSOS(userId, loc.latitude, loc.longitude);
    } catch (err) {
      console.error('SOS trigger failed (still marked active):', err);
    }
  },

  // ── UI ───────────────────────────────────────────────────────────────────────
  setDashboardExpanded: (v: boolean) => set({ dashboardExpanded: v }),
  setMapMode: (mode) => set({ mapMode: mode }),
}));

// Helper
function haversine(a: Coordinate, b: Coordinate): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
    Math.cos((b.latitude * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
