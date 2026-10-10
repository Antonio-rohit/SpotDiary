import { Platform } from 'react-native';

/**
 * Returns the configured API base URL for SpotDiary backend.
 * 
 * Hierarchy:
 * 1. Explicit EXPO_PUBLIC_API_BASE_URL (from .env or app environment)
 * 2. Android Emulator loopback alias (10.0.2.2 points to host machine localhost:3000)
 * 3. Default localhost:3000 for iOS Simulator, Web, or Node
 * 
 * Physical Device Testing Note:
 * On physical phones (via Expo Go), localhost refers to the phone itself.
 * Set EXPO_PUBLIC_API_BASE_URL=http://<YOUR_LAN_IP>:3000 (e.g. http://192.168.1.5:3000)
 * in apps/mobile/.env or when starting Expo.
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/$/, '');
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
}
