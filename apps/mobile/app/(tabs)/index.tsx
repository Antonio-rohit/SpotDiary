import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CATEGORIES, Place } from '@spotdiary/shared';
import { apiClient } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';

const { width } = Dimensions.get('window');

const DISPLAY_CATEGORIES = ['All', ...CATEGORIES];

export default function HomeScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaces();
    if (isAuthenticated) {
      fetchSavedPlaces();
    }
  }, [selectedCategory, isAuthenticated]);

  const fetchPlaces = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'All') params.set('category', selectedCategory);
      if (searchQuery.trim()) params.set('query', searchQuery.trim());

      const endpoint = `/api/places/search?${params.toString()}`;
      const res = await apiClient.get<{ places: Place[] }>(endpoint);

      if (res && Array.isArray(res.places)) {
        setPlaces(res.places);
      } else {
        setPlaces([]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to load places. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSavedPlaces = async () => {
    try {
      const res = await apiClient.get<{ places: Place[] }>('/api/places/saved');
      if (res && Array.isArray(res.places)) {
        setSavedPlaceIds(new Set(res.places.map((p) => p.id)));
      }
    } catch {}
  };

  const toggleSavePlace = async (placeId: string) => {
    if (!isAuthenticated) {
      router.push('/(tabs)/profile' as any);
      return;
    }

    try {
      const placeObj = places.find((p) => p.id === placeId);
      const res = await apiClient.post<{ saved: boolean }>('/api/places/saved', {
        place_id: placeId,
        place: placeObj,
      });
      setSavedPlaceIds((prev) => {
        const next = new Set(prev);
        if (res.saved) {
          next.add(placeId);
        } else {
          next.delete(placeId);
        }
        return next;
      });
    } catch (err: any) {
      alert(err.message || 'Failed to update saved spot.');
    }
  };

  const handleSearchSubmit = () => {
    fetchPlaces();
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPlaces();
    if (isAuthenticated) fetchSavedPlaces();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#254542" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headingTitle}>Enjoy your</Text>
            <Text style={styles.headingSubtitle}>
              morning <Text style={styles.highlightText}>Coffee 🍃</Text>
            </Text>
          </View>
          <TouchableOpacity style={styles.bellButton} onPress={fetchPlaces}>
            <Text style={{ fontSize: 18 }}>🔄</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search Pune cafes & places..."
              placeholderTextColor="#89928D"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={{ fontSize: 14, color: '#89928D', paddingHorizontal: 6 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.filterButton} onPress={handleSearchSubmit}>
            <Text style={{ color: '#FFFFFF', fontSize: 18 }}>➔</Text>
          </TouchableOpacity>
        </View>

        {/* Category Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
          {DISPLAY_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Error State with Retry Button */}
        {errorMessage && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchPlaces}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading Indicator */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#254542" />
            <Text style={styles.loadingText}>Discovering places in Pune...</Text>
          </View>
        ) : places.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>☕</Text>
            <Text style={styles.emptyTitle}>No places found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search query or selecting a different category.</Text>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
            >
              <Text style={styles.resetButtonText}>Reset Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Section 1: Nearby Places Horizontal Scroll */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured Pune Places</Text>
              <Text style={styles.placesCountText}>{places.length} spots</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalCardScroll}>
              {places.slice(0, 5).map((place) => {
                const isSaved = savedPlaceIds.has(place.id);
                const imageUrl =
                  place.image_urls?.[0] ||
                  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000';

                return (
                  <TouchableOpacity
                    key={place.id}
                    style={styles.cardHorizontal}
                    onPress={() => router.push(`/place/${place.id}` as any)}
                  >
                    <View style={styles.cardImageContainer}>
                      <Image source={{ uri: imageUrl }} style={styles.cardImage} />
                      <TouchableOpacity
                        style={[styles.heartOverlay, isSaved && styles.heartOverlayActive]}
                        onPress={() => toggleSavePlace(place.id)}
                      >
                        <Text style={{ fontSize: 14 }}>{isSaved ? '❤️' : '🤍'}</Text>
                      </TouchableOpacity>
                      <View style={styles.locationBadge}>
                        <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600' }}>
                          📍 {place.locality}, Pune
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardBody}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {place.name}
                        </Text>
                        <Text style={styles.cardDistance}>{place.distance_km || 1.2} km</Text>
                      </View>

                      <View style={styles.cardRatingRow}>
                        <Text style={styles.starIcon}>★</Text>
                        <Text style={styles.ratingText}>
                          {place.rating_avg || 4.5}{' '}
                          <Text style={styles.reviewCountText}>/ {place.reviews_count || 100} reviews</Text>
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Section 2: Recommendations List */}
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={styles.sectionTitle}>More Places To Explore</Text>
            </View>

            {places.slice(5).map((place) => {
              const isSaved = savedPlaceIds.has(place.id);
              const imageUrl =
                place.image_urls?.[0] ||
                'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000';

              return (
                <TouchableOpacity
                  key={place.id}
                  style={styles.specialCardRow}
                  onPress={() => router.push(`/place/${place.id}` as any)}
                >
                  <Image source={{ uri: imageUrl }} style={styles.specialImage} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.specialTitle} numberOfLines={1}>
                        {place.name}
                      </Text>
                      <Text style={styles.specialDistance}>{place.distance_km || 1.5} km</Text>
                    </View>
                    <Text style={styles.specialLocality}>📍 {place.locality}, Pune</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Text style={styles.starIcon}>★</Text>
                      <Text style={styles.ratingText}>
                        {place.rating_avg || 4.5}{' '}
                        <Text style={styles.reviewCountText}>/ {place.reviews_count || 80} reviews</Text>
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={{ padding: 8 }}
                    onPress={() => toggleSavePlace(place.id)}
                  >
                    <Text style={{ fontSize: 16 }}>{isSaved ? '❤️' : '🤍'}</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5EE',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#273C3A',
  },
  headingSubtitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#273C3A',
  },
  highlightText: {
    color: '#AAB69A',
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E7DF',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 50,
    borderWidth: 1,
    borderColor: '#E8E7DF',
  },
  searchIcon: {
    marginRight: 8,
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#273C3A',
    fontWeight: '500',
  },
  filterButton: {
    width: 50,
    height: 50,
    borderRadius: 20,
    backgroundColor: '#254542',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  categoryPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E7DF',
    marginRight: 10,
  },
  categoryPillActive: {
    backgroundColor: '#254542',
    borderColor: '#254542',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#273C3A',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#273C3A',
  },
  placesCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#89928D',
  },
  horizontalCardScroll: {
    flexDirection: 'row',
  },
  cardHorizontal: {
    width: width * 0.65,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 10,
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#E8E7DF',
  },
  cardImageContainer: {
    width: '100%',
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heartOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartOverlayActive: {
    backgroundColor: '#FFFFFF',
  },
  locationBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cardBody: {
    marginTop: 10,
    paddingHorizontal: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#273C3A',
    flex: 1,
    marginRight: 6,
  },
  cardDistance: {
    fontSize: 12,
    fontWeight: '600',
    color: '#89928D',
  },
  cardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  starIcon: {
    color: '#F59E0B',
    fontSize: 14,
    marginRight: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#273C3A',
  },
  reviewCountText: {
    fontWeight: '400',
    color: '#89928D',
  },
  specialCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E7DF',
  },
  specialImage: {
    width: 65,
    height: 65,
    borderRadius: 16,
  },
  specialTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#273C3A',
    flex: 1,
  },
  specialLocality: {
    fontSize: 11,
    color: '#89928D',
    marginTop: 2,
  },
  specialDistance: {
    fontSize: 11,
    color: '#89928D',
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#89928D',
    fontWeight: '600',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E7DF',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#273C3A',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#89928D',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  resetButton: {
    marginTop: 16,
    backgroundColor: '#254542',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    fontSize: 12,
    color: '#B91C1C',
    flex: 1,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#B91C1C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginLeft: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
