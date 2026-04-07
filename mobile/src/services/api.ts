/**
 * SafeStep — API Service Layer
 * All backend calls with offline caching via AsyncStorage
 */

import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = __DEV__
  ? 'http://10.0.2.2:8000'   // Android emulator → localhost
  : 'https://api.safestep.io';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyzeResponse {
  lat: number;
  lng: number;
  safety_score: number;
  color_code: string;
  risk_level: 'SAFE' | 'MODERATE' | 'RISKY' | 'DANGER';
  status_message: string;
  confidence: number;
  nearby_incidents: NearbyIncident[];
  data_points_used: number;
}

export interface NearbyIncident {
  id: string;
  incident_type: string;
  description?: string;
  severity: number;
  distance_m: number;
  occurred_at: string;
}

export interface SafeRouteResponse {
  overall_safety_score: number;
  color_code: string;
  risk_level: string;
  total_distance_m: number;
  estimated_time_min: number;
  segments: RouteSegment[];
  safer_alternative: boolean;
}

export interface RouteSegment {
  waypoints: { lat: number; lng: number }[];
  safety_score: number;
  color_code: string;
  distance_m: number;
}

export interface ReportPayload {
  latitude: number;
  longitude: number;
  report_type: string;
  severity: number;
  description?: string;
  anonymous: boolean;
  user_id?: string;
}

// ─── Cache Helpers ────────────────────────────────────────────────────────────

const cache = {
  set: async (key: string, data: any) => {
    await AsyncStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  },
  get: async <T>(key: string): Promise<T | null> => {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data as T;
  },
};

// ─── API Client ───────────────────────────────────────────────────────────────

class SafeStepAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Request interceptor
    this.client.interceptors.request.use(config => {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    // Response interceptor
    this.client.interceptors.response.use(
      res => res,
      async err => {
        if (!err.response) {
          console.warn('[API] Network error — checking cache...');
        }
        return Promise.reject(err);
      }
    );
  }

  /**
   * Analyze safety for a coordinate.
   * Falls back to cached result if offline.
   */
  async analyzeLocation(
    lat: number,
    lng: number,
    radius_m = 500
  ): Promise<AnalyzeResponse> {
    const cacheKey = `analyze_${lat.toFixed(4)}_${lng.toFixed(4)}`;

    try {
      const res = await this.client.post<AnalyzeResponse>('/analyze', {
        lat,
        lng,
        radius_m,
      });
      await cache.set(cacheKey, res.data);
      return res.data;
    } catch (err) {
      const cached = await cache.get<AnalyzeResponse>(cacheKey);
      if (cached) {
        console.log('[API] Returning cached analyze result');
        return cached;
      }
      throw err;
    }
  }

  /**
   * Get a safe route between two points.
   */
  async getSafeRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    mode: 'walking' | 'driving' | 'cycling' = 'walking'
  ): Promise<SafeRouteResponse> {
    const cacheKey = `route_${originLat.toFixed(4)}_${originLng.toFixed(4)}_${destLat.toFixed(4)}_${destLng.toFixed(4)}`;

    try {
      const res = await this.client.post<SafeRouteResponse>('/routes/safe', {
        origin: { lat: originLat, lng: originLng },
        destination: { lat: destLat, lng: destLng },
        mode,
      });
      await cache.set(cacheKey, res.data);
      return res.data;
    } catch (err) {
      const cached = await cache.get<SafeRouteResponse>(cacheKey);
      if (cached) return cached;
      throw err;
    }
  }

  /**
   * Submit a crowdsourced user report.
   */
  async submitReport(payload: ReportPayload): Promise<void> {
    await this.client.post('/reports', payload);
  }

  /**
   * Trigger SOS emergency alert.
   */
  async triggerSOS(userId: string, lat: number, lng: number, message?: string) {
    return this.client.post('/sos', { user_id: userId, latitude: lat, longitude: lng, message });
  }

  /**
   * Health check.
   */
  async healthCheck() {
    return this.client.get('/health');
  }
}

export const api = new SafeStepAPI();
