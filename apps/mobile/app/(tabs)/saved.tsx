import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Place } from '@spotdiary/shared';
import { apiClient } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';

export default function SavedScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadSavedPlaces();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadSavedPlaces = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ places: Place[]; authenticated: boolean }>('/api/places/saved');
      if (res && Array.isArray(res.places)) {
        setSavedPlaces(res.places);
      } else {
        setSavedPlaces([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load saved places.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUnsave = async (placeId: string) => {
    try {
      await apiClient.post('/api/places/saved', { place_id: placeId });
      setSavedPlaces((prev) => prev.filter((p) => p.id !== placeId));
    } catch (err: any) {
      alert(err.message || 'Failed to remove spot.');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (isAuthenticated) {
      loadSavedPlaces();
    } else {
      setRefreshing(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authPromptContainer}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>🔒</Text>
          <Text style={styles.authPromptTitle}>Sign in to view saved places</Text>
          <Text style={styles.authPromptSubtitle}>
            Save your favorite cafes, date night spots, and bakeries across Pune.
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.push('/(tabs)/profile' as any)}
          >
            <Text style={styles.signInButtonText}>Go to Profile / Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#254542" />}
      >
        <Text style={styles.title}>Saved Wishlist Places</Text>
        <Text style={styles.subtitle}>Cafes & spots in Pune you want to visit later</Text>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <TouchableOpacity onPress={loadSavedPlaces} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#254542" />
            <Text style={styles.loadingText}>Loading your wishlist...</Text>
          </View>
        ) : savedPlaces.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>🤍</Text>
            <Text style={styles.emptyTitle}>No saved spots yet</Text>
            <Text style={styles.emptySubtitle}>Tap the heart icon on any place card to save it to your wishlist.</Text>
            <TouchableOpacity
              style={styles.discoverButton}
              onPress={() => router.push('/(tabs)' as any)}
            >
              <Text style={styles.discoverButtonText}>Discover Pune Places</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ marginTop: 15 }}>
            {savedPlaces.map((place) => {
              const imageSrc =
                place.image_urls?.[0] ||
                'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000';

              return (
                <TouchableOpacity
                  key={place.id}
                  style={styles.card}
                  onPress={() => router.push(`/place/${place.id}` as any)}
                >
                  <Image source={{ uri: imageSrc }} style={styles.image} />
                  <View style={styles.info}>
                    <Text style={styles.placeName} numberOfLines={1}>
                      {place.name}
                    </Text>
                    <Text style={styles.locality}>📍 {place.locality}, Pune</Text>
                    <Text style={styles.rating}>★ {place.rating_avg || 4.5} ({place.reviews_count || 100} reviews)</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.unsaveBtn}
                    onPress={() => handleUnsave(place.id)}
                    accessibilityLabel="Remove from wishlist"
                  >
                    <Text style={{ fontSize: 16 }}>❤️</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={{ height: 90 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F5EE' },
  scrollContent: { padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#273C3A' },
  subtitle: { fontSize: 12, color: '#89928D', marginTop: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E7DF',
  },
  image: { width: 75, height: 75, borderRadius: 16 },
  info: { marginLeft: 12, justifyContent: 'center', flex: 1 },
  placeName: { fontSize: 15, fontWeight: '800', color: '#273C3A' },
  locality: { fontSize: 12, color: '#89928D', marginTop: 2 },
  rating: { fontSize: 12, color: '#F59E0B', fontWeight: '700', marginTop: 4 },
  unsaveBtn: { padding: 10 },
  loadingContainer: { paddingVertical: 50, alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 12, color: '#89928D', fontWeight: '600' },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E7DF',
    marginTop: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#273C3A' },
  emptySubtitle: { fontSize: 12, color: '#89928D', textAlign: 'center', marginTop: 4, lineHeight: 18 },
  discoverButton: {
    marginTop: 16,
    backgroundColor: '#254542',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
  },
  discoverButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  authPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  authPromptTitle: { fontSize: 18, fontWeight: '800', color: '#273C3A', textAlign: 'center' },
  authPromptSubtitle: { fontSize: 12, color: '#89928D', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  signInButton: {
    marginTop: 20,
    backgroundColor: '#254542',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 18,
  },
  signInButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
  },
  errorText: { fontSize: 12, color: '#B91C1C', flex: 1 },
  retryBtn: { backgroundColor: '#B91C1C', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  retryBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
