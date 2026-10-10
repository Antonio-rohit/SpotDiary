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
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Place, PeopleContext, Visibility } from '@spotdiary/shared';
import { apiClient } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';

export default function MobilePlaceDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated } = useAuth();

  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Log Visit Modal State
  const [isLogVisitOpen, setIsLogVisitOpen] = useState(false);
  const [bestItem, setBestItem] = useState('');
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState(5);
  const [peopleContext, setPeopleContext] = useState<PeopleContext>('Solo');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [tagsInput, setTagsInput] = useState('');
  const [submittingVisit, setSubmittingVisit] = useState(false);

  const placeId = Array.isArray(id) ? id[0] : (id || '');

  useEffect(() => {
    if (placeId) {
      loadPlaceDetails();
      if (isAuthenticated) {
        checkIfSaved();
      }
    }
  }, [placeId, isAuthenticated]);

  const loadPlaceDetails = async () => {
    if (!placeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; place: Place }>(`/api/places/${encodeURIComponent(placeId)}`);
      if (res && res.place) {
        setPlace(res.place);
      } else {
        setError('Place details not found.');
      }
    } catch (err: any) {
      // Fallback: search query for place
      try {
        const searchRes = await apiClient.get<{ places: Place[] }>(`/api/places/search?query=${encodeURIComponent(placeId)}`);
        const found = searchRes.places?.find((p) => p.id === placeId) || searchRes.places?.[0];
        if (found) {
          setPlace(found);
        } else {
          setError(err.message || 'Unable to load place details.');
        }
      } catch {
        setError(err.message || 'Unable to load place details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkIfSaved = async () => {
    try {
      const res = await apiClient.get<{ places: Place[] }>('/api/places/saved');
      if (res && Array.isArray(res.places)) {
        setIsSaved(res.places.some((p) => p.id === id));
      }
    } catch {}
  };

  const toggleSave = async () => {
    if (!isAuthenticated) {
      router.push('/(tabs)/profile' as any);
      return;
    }

    try {
      const res = await apiClient.post<{ saved: boolean }>('/api/places/saved', {
        place_id: placeId,
        place,
      });
      setIsSaved(!!res.saved);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update wishlist.');
    }
  };

  const handleCreateVisit = async () => {
    if (!bestItem.trim()) {
      Alert.alert('Validation Error', 'Please enter your favorite food, drink or best order.');
      return;
    }

    setSubmittingVisit(true);
    try {
      const tagsArray = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter((t) => t.length > 0);

      await apiClient.post('/api/visits', {
        place_id: id,
        visited_at: new Date().toISOString(),
        rating,
        best_item: bestItem.trim(),
        notes: notes.trim(),
        people_context: peopleContext,
        visibility,
        tags: tagsArray,
      });

      setIsLogVisitOpen(false);
      setBestItem('');
      setNotes('');
      setTagsInput('');
      Alert.alert('Success!', 'Your visit memory has been recorded in your SpotDiary.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record visit memory.');
    } finally {
      setSubmittingVisit(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#254542" />
          <Text style={styles.loadingText}>Loading spot details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !place) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>⚠️</Text>
          <Text style={styles.errorTitle}>Place Not Found</Text>
          <Text style={styles.errorSubtitle}>{error || 'The requested spot could not be retrieved.'}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back to Discovery</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const imageSrc =
    place.image_urls?.[0] ||
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconCircle} onPress={() => router.back()}>
            <Text style={{ fontSize: 18 }}>‹</Text>
          </TouchableOpacity>

          <View style={styles.locationHeader}>
            <Text style={{ fontSize: 14 }}>📍</Text>
            <Text style={styles.locationHeaderText}>{place.locality}, Pune</Text>
          </View>

          <TouchableOpacity style={styles.iconCircle} onPress={toggleSave}>
            <Text style={{ fontSize: 16 }}>{isSaved ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Photo Card */}
        <View style={styles.heroCard}>
          <Image source={{ uri: imageSrc }} style={styles.heroImage} />
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{place.category}</Text>
          </View>
        </View>

        {/* Place Title & Distance */}
        <View style={styles.titleRow}>
          <Text style={styles.placeTitle}>{place.name}</Text>
          <Text style={styles.distanceTag}>{place.distance_km || 1.2} km</Text>
        </View>

        {/* Rating Row */}
        <View style={styles.ratingRow}>
          <Text style={styles.starIcon}>★</Text>
          <Text style={styles.ratingText}>{place.rating_avg || 4.5}</Text>
          <Text style={styles.reviewCountText}>/ {place.reviews_count || 100} reviews</Text>
        </View>

        {/* Offerings Row */}
        <View style={styles.offeringsRow}>
          {[
            { label: 'Coffee', icon: '☕' },
            { label: 'Bites', icon: '🥪' },
            { label: 'Dessert', icon: '🍰' },
            { label: 'Date Spot', icon: '✨' },
          ].map((item, idx) => (
            <View key={idx} style={styles.offeringPill}>
              <View style={styles.offeringIconBox}>
                <Text style={{ fontSize: 20 }}>{item.icon}</Text>
              </View>
              <Text style={styles.offeringLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Description & Address */}
        <Text style={styles.descriptionText}>{place.description}</Text>
        <Text style={styles.addressText}>📌 {place.address}</Text>

        {/* Log Visit Action Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (!isAuthenticated) {
              router.push('/(tabs)/profile' as any);
            } else {
              setIsLogVisitOpen(true);
            }
          }}
        >
          <Text style={styles.actionButtonText}>
            {isAuthenticated ? '📖 Log Visit Memory' : 'Sign In to Log Visit'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Log Visit Modal */}
      <Modal visible={isLogVisitOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Visit to {place.name}</Text>
              <TouchableOpacity onPress={() => setIsLogVisitOpen(false)}>
                <Text style={{ fontSize: 18, color: '#89928D' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>☕ Best Item / Favorite Food or Drink *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Hazelnut Cold Brew, Tiramisu"
                placeholderTextColor="#89928D"
                value={bestItem}
                onChangeText={setBestItem}
              />

              <Text style={styles.fieldLabel}>Rating (1 to 5 Stars)</Text>
              <View style={styles.ratingPickerRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    style={[styles.starBtn, rating === star && styles.starBtnActive]}
                    onPress={() => setRating(star)}
                  >
                    <Text style={[styles.starBtnText, rating === star && styles.starBtnTextActive]}>
                      ★ {star}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Who were you with?</Text>
              <View style={styles.contextRow}>
                {(['Solo', 'Friends', 'Partner', 'Family', 'Colleagues'] as PeopleContext[]).map((ctx) => (
                  <TouchableOpacity
                    key={ctx}
                    style={[styles.contextBtn, peopleContext === ctx && styles.contextBtnActive]}
                    onPress={() => setPeopleContext(ctx)}
                  >
                    <Text style={[styles.contextBtnText, peopleContext === ctx && styles.contextBtnTextActive]}>
                      {ctx}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Personal Experience / Notes</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Atmosphere, seating, memorable moments..."
                placeholderTextColor="#89928D"
                multiline
                value={notes}
                onChangeText={setNotes}
              />

              <Text style={styles.fieldLabel}>Tags (comma separated)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. coffee, outdoor, romantic"
                placeholderTextColor="#89928D"
                value={tagsInput}
                onChangeText={setTagsInput}
              />

              <TouchableOpacity
                style={styles.submitVisitBtn}
                onPress={handleCreateVisit}
                disabled={submittingVisit}
              >
                {submittingVisit ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitVisitBtnText}>Save Visit Record</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F5EE' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 13, color: '#89928D', fontWeight: '600' },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#273C3A' },
  errorSubtitle: { fontSize: 12, color: '#89928D', textAlign: 'center', marginTop: 4, marginBottom: 16 },
  backButton: { backgroundColor: '#254542', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 16 },
  backButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E7DF',
  },
  locationHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationHeaderText: { fontSize: 14, fontWeight: '700', color: '#273C3A' },
  heroCard: { width: '100%', height: 230, borderRadius: 24, overflow: 'hidden', position: 'relative', marginBottom: 18 },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  categoryBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(37, 69, 66, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  placeTitle: { fontSize: 22, fontWeight: '800', color: '#273C3A', flex: 1, marginRight: 8 },
  distanceTag: { fontSize: 14, fontWeight: '700', color: '#AAB69A' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 18 },
  starIcon: { color: '#F59E0B', fontSize: 14, marginRight: 4 },
  ratingText: { fontSize: 13, fontWeight: '700', color: '#273C3A' },
  reviewCountText: { fontSize: 13, color: '#89928D', fontWeight: '400' },
  offeringsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  offeringPill: { alignItems: 'center' },
  offeringIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E7DF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  offeringLabel: { fontSize: 11, fontWeight: '700', color: '#273C3A' },
  descriptionText: { fontSize: 13, color: '#273C3A', lineHeight: 19, marginBottom: 8 },
  addressText: { fontSize: 12, color: '#89928D', marginBottom: 20 },
  actionButton: {
    height: 54,
    backgroundColor: '#254542',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#254542',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  actionButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#273C3A' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#273C3A', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#F8F5EE',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#273C3A',
    borderWidth: 1,
    borderColor: '#E8E7DF',
  },
  ratingPickerRow: { flexDirection: 'row', gap: 6 },
  starBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 12, backgroundColor: '#F8F5EE' },
  starBtnActive: { backgroundColor: '#254542' },
  starBtnText: { fontSize: 12, fontWeight: '700', color: '#273C3A' },
  starBtnTextActive: { color: '#FFFFFF' },
  contextRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  contextBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F8F5EE' },
  contextBtnActive: { backgroundColor: '#254542' },
  contextBtnText: { fontSize: 11, fontWeight: '600', color: '#273C3A' },
  contextBtnTextActive: { color: '#FFFFFF' },
  submitVisitBtn: {
    marginTop: 20,
    backgroundColor: '#254542',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitVisitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
