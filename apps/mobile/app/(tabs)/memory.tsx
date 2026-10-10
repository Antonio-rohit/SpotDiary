import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { apiClient } from '../../src/api/client';
import { pickImageFromGallery, SelectedPhoto } from '../../src/utils/imagePicker';
import {
  Visit,
  Place,
  PeopleContext,
  Visibility,
  parseNaturalLanguageMemoryQuery,
  filterVisits,
  NaturalLanguageInterpretation,
} from '@spotdiary/shared';

const PEOPLE_OPTIONS: PeopleContext[] = ['Solo', 'Partner', 'Friends', 'Family', 'Colleagues', 'Other'];

export default function MemoryScreen() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [visits, setVisits] = useState<Visit[]>([]);
  const [placesMap, setPlacesMap] = useState<Record<string, Place>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & NL query state
  const [searchQuery, setSearchQuery] = useState('');
  const [nlInterpretation, setNlInterpretation] = useState<NaturalLanguageInterpretation | null>(null);

  // Edit Visit Modal State
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [editBestItem, setEditBestItem] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editRating, setEditRating] = useState(5);
  const [editPeopleContext, setEditPeopleContext] = useState<PeopleContext>('Solo');
  const [editVisitedAt, setEditVisitedAt] = useState('');
  const [editVisibility, setEditVisibility] = useState<Visibility>('private');
  const [editTagsInput, setEditTagsInput] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Photo upload state
  const [selectedUploadPhoto, setSelectedUploadPhoto] = useState<SelectedPhoto | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const fetchVisitsAndPlaces = useCallback(async () => {
    if (!isAuthenticated) return;
    setErrorMessage(null);

    try {
      const data = await apiClient.get<{ visits: Visit[] }>('/api/visits');
      const loadedVisits = data.visits || [];
      setVisits(loadedVisits);

      // Fetch place metadata for places referenced in visits
      const placeIds = Array.from(new Set(loadedVisits.map((v) => v.place_id).filter(Boolean)));
      if (placeIds.length > 0) {
        const placePromises = placeIds.map(async (pId) => {
          try {
            const pData = await apiClient.get<{ place: Place }>(`/api/places/${encodeURIComponent(pId)}`);
            return pData.place;
          } catch {
            return null;
          }
        });
        const fetchedPlaces = await Promise.all(placePromises);
        const map: Record<string, Place> = {};
        fetchedPlaces.forEach((p) => {
          if (p) map[p.id] = p;
        });
        setPlacesMap((prev) => ({ ...prev, ...map }));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load personal visit diary.');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      fetchVisitsAndPlaces().finally(() => setLoading(false));
    }
  }, [isAuthenticated, fetchVisitsAndPlaces]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchVisitsAndPlaces();
    setRefreshing(false);
  }, [fetchVisitsAndPlaces]);

  // Handle Memory Search (Natural Language & Keyword)
  const handleQueryChange = (text: string) => {
    setSearchQuery(text);
    if (text.trim().length > 0) {
      const parsed = parseNaturalLanguageMemoryQuery(text);
      setNlInterpretation(parsed);
    } else {
      setNlInterpretation(null);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setNlInterpretation(null);
  };

  // Compute filtered visits
  const enrichedVisits: Visit[] = visits.map((v) => ({
    ...v,
    place: placesMap[v.place_id] || v.place,
  })) as Visit[];

  let displayedVisits: Visit[] = enrichedVisits;
  if (searchQuery.trim().length > 0 && nlInterpretation) {
    displayedVisits = filterVisits(enrichedVisits, {
      query: searchQuery,
      category: nlInterpretation.extractedFilters.category,
      locality: nlInterpretation.extractedFilters.locality,
      peopleContext: nlInterpretation.extractedFilters.peopleContext,
      bestItem: nlInterpretation.extractedFilters.bestItem,
      minRating: nlInterpretation.extractedFilters.minRating,
    });
  }

  // Delete Visit
  const handleDeleteVisit = (id: string) => {
    Alert.alert(
      'Delete Visit Memory',
      'Are you sure you want to permanently delete this visit record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/api/visits?id=${encodeURIComponent(id)}`);
              setVisits((prev) => prev.filter((v) => v.id !== id));
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message || 'Could not delete visit record.');
            }
          },
        },
      ]
    );
  };

  // Open Edit Modal
  const openEditModal = (visit: Visit) => {
    setEditingVisit(visit);
    setEditBestItem(visit.best_item);
    setEditNotes(visit.notes || '');
    setEditRating(visit.rating);
    setEditPeopleContext(visit.people_context);
    setEditVisitedAt(
      visit.visited_at ? visit.visited_at.substring(0, 10) : new Date().toISOString().substring(0, 10)
    );
    setEditVisibility(visit.visibility || 'private');
    setEditTagsInput((visit.tags || []).join(', '));
    setEditError(null);
    setSelectedUploadPhoto(null);
    setPhotoCaption('');
  };

  // Save Visit Edit
  const handleSaveEdit = async () => {
    if (!editingVisit) return;
    if (!editBestItem.trim()) {
      setEditError('Best item / dish is required.');
      return;
    }

    setSavingEdit(true);
    setEditError(null);

    try {
      const tagsArray = editTagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter((t) => t.length > 0);

      const res = await apiClient.put<{ success: boolean; visit: Visit }>('/api/visits', {
        id: editingVisit.id,
        best_item: editBestItem.trim(),
        notes: editNotes.trim(),
        rating: editRating,
        people_context: editPeopleContext,
        visited_at: new Date(editVisitedAt).toISOString(),
        visibility: editVisibility,
        tags: tagsArray,
      });

      if (res.success && res.visit) {
        setVisits((prev) => prev.map((v) => (v.id === editingVisit.id ? res.visit : v)));
        setEditingVisit(null);
      }
    } catch (err: any) {
      setEditError(err.message || 'Failed to update visit record.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Pick Photo for Upload
  const handleSelectPhoto = async () => {
    const photo = await pickImageFromGallery();
    if (photo) {
      setSelectedUploadPhoto(photo);
    }
  };

  // Upload Photo
  const handleUploadPhoto = async () => {
    if (!editingVisit || !selectedUploadPhoto) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('visit_id', editingVisit.id);
      if (photoCaption.trim()) {
        formData.append('caption', photoCaption.trim());
      }
      formData.append('file', {
        uri: selectedUploadPhoto.uri,
        name: selectedUploadPhoto.name,
        type: selectedUploadPhoto.type,
      } as any);

      const res = await apiClient.upload<{ success: boolean; photo: any }>('/api/visits/photos', formData);

      if (res.success && res.photo) {
        const photoUrl = res.photo.url;
        const currentPhotos = editingVisit.photos || [];
        const updatedVisit = {
          ...editingVisit,
          photos: [...currentPhotos, photoUrl],
        };
        setEditingVisit(updatedVisit);
        setVisits((prev) => prev.map((v) => (v.id === editingVisit.id ? updatedVisit : v)));
        setSelectedUploadPhoto(null);
        setPhotoCaption('');
        Alert.alert('Upload Complete', 'Photograph successfully added to this visit.');
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload visit photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Delete Photo from Visit
  const handleDeletePhoto = (photoUrl: string) => {
    if (!editingVisit) return;

    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo from this visit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(
              `/api/visits/photos?visit_id=${encodeURIComponent(editingVisit.id)}&url=${encodeURIComponent(photoUrl)}`
            );
            const updatedPhotos = (editingVisit.photos || []).filter(
              (p: any) => (typeof p === 'string' ? p : p.url) !== photoUrl
            );
            const updatedVisit = { ...editingVisit, photos: updatedPhotos };
            setEditingVisit(updatedVisit);
            setVisits((prev) => prev.map((v) => (v.id === editingVisit.id ? updatedVisit : v)));
          } catch (err: any) {
            Alert.alert('Deletion Failed', err.message || 'Could not remove photograph.');
          }
        },
      },
    ]);
  };

  if (authLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#254542" />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.unauthCard}>
          <Text style={styles.unauthEmoji}>📖</Text>
          <Text style={styles.unauthTitle}>Sign in to view your Diary</Text>
          <Text style={styles.unauthSubtitle}>
            Your personal visit history, favorite orders, notes, and memory search are securely stored on your account.
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.push('/(tabs)/profile')}
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
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#254542']} />}
      >
        <Text style={styles.title}>Personal Visit History</Text>
        <Text style={styles.subtitle}>Digital Travel Diary & Experience Vault</Text>

        {/* Natural Language Memory Search Bar */}
        <View style={styles.searchBox}>
          <TextInput
            placeholder="Search memory: e.g. cold coffee with partner in Baner"
            placeholderTextColor="#89928D"
            style={styles.input}
            value={searchQuery}
            onChangeText={handleQueryChange}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Natural Language Interpretation Badge */}
        {nlInterpretation && searchQuery.trim().length > 0 && (
          <View style={styles.interpretationBox}>
            <View style={styles.interpretationHeader}>
              <Text style={styles.interpretationTitle}>✨ Interpreted Search Filters</Text>
              <Text style={styles.confidenceText}>
                {Math.round(nlInterpretation.confidence * 100)}% match
              </Text>
            </View>
            <View style={styles.filterPillsRow}>
              {nlInterpretation.extractedFilters.category && (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>
                    Category: {nlInterpretation.extractedFilters.category}
                  </Text>
                </View>
              )}
              {nlInterpretation.extractedFilters.locality && (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>
                    Locality: {nlInterpretation.extractedFilters.locality}
                  </Text>
                </View>
              )}
              {nlInterpretation.extractedFilters.peopleContext && (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>
                    With: {nlInterpretation.extractedFilters.peopleContext}
                  </Text>
                </View>
              )}
              {nlInterpretation.extractedFilters.bestItem && (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>
                    Item: {nlInterpretation.extractedFilters.bestItem}
                  </Text>
                </View>
              )}
              {nlInterpretation.extractedFilters.minRating && (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>
                    Rating: ≥ {nlInterpretation.extractedFilters.minRating}★
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#254542" />
            <Text style={styles.loadingText}>Loading your visit diary...</Text>
          </View>
        )}

        {/* Error State */}
        {errorMessage && !loading && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchVisitsAndPlaces}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty State */}
        {!loading && !errorMessage && displayedVisits.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🍃</Text>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matching visits found' : 'No visit memories logged yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try adjusting your search terms or clearing the query filter.'
                : 'Explore Pune places in the Discovery tab and tap "Log a Visit" to record your experiences.'}
            </Text>
          </View>
        )}

        {/* Visit List */}
        {!loading &&
          displayedVisits.map((visit) => {
            const place = placesMap[visit.place_id] || visit.place;
            const placeName = place?.name || 'Pune Spot';
            const locality = place?.locality || 'Pune';
            const visitDate = visit.visited_at
              ? new Date(visit.visited_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Recent';

            return (
              <View key={visit.id} style={styles.visitCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <TouchableOpacity
                      onPress={() => router.push(`/place/${encodeURIComponent(visit.place_id)}`)}
                    >
                      <Text style={styles.placeName}>{placeName}</Text>
                    </TouchableOpacity>
                    <Text style={styles.date}>
                      Visited on {visitDate} • {locality}
                    </Text>
                  </View>
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      onPress={() => openEditModal(visit)}
                      style={styles.actionBtn}
                    >
                      <Text style={styles.actionBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteVisit(visit.id)}
                      style={styles.actionBtn}
                    >
                      <Text style={styles.actionBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.pillRow}>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>☕ {visit.best_item}</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>With: {visit.people_context}</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>★ {visit.rating}/5</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: '#F0EBE0' }]}>
                    <Text style={styles.pillText}>
                      {visit.visibility === 'private' ? '🔒 Private' : '🌐 Public'}
                    </Text>
                  </View>
                </View>

                {visit.notes ? (
                  <Text style={styles.notes}>&ldquo;{visit.notes}&rdquo;</Text>
                ) : null}

                {/* Visit Photos Carousel */}
                {visit.photos && visit.photos.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.photosScroll}
                  >
                    {visit.photos.map((photo: any, pIdx: number) => {
                      const url = typeof photo === 'string' ? photo : photo.url || photo.storage_path;
                      return (
                        <Image
                          key={pIdx}
                          source={{ uri: url }}
                          style={styles.thumbnailPhoto}
                          resizeMode="cover"
                        />
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            );
          })}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Edit Visit Modal */}
      {editingVisit && (
        <Modal visible={true} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Visit Memory</Text>
                <TouchableOpacity onPress={() => setEditingVisit(null)}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {editError && (
                  <View style={styles.modalErrorBox}>
                    <Text style={styles.modalErrorText}>{editError}</Text>
                  </View>
                )}

                <Text style={styles.fieldLabel}>☕ Best Item / Food Order</Text>
                <TextInput
                  value={editBestItem}
                  onChangeText={setEditBestItem}
                  placeholder="e.g. Cold Coffee, Butter Croissant"
                  placeholderTextColor="#89928D"
                  style={styles.modalInput}
                />

                <Text style={styles.fieldLabel}>Rating (1-5)</Text>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setEditRating(star)}
                      style={[
                        styles.ratingButton,
                        editRating === star && styles.ratingButtonSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ratingButtonText,
                          editRating === star && styles.ratingButtonTextSelected,
                        ]}
                      >
                        {star} ★
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>People Context</Text>
                <View style={styles.optionsWrap}>
                  {PEOPLE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setEditPeopleContext(opt)}
                      style={[
                        styles.chipButton,
                        editPeopleContext === opt && styles.chipButtonSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipButtonText,
                          editPeopleContext === opt && styles.chipButtonTextSelected,
                        ]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Visited Date (YYYY-MM-DD)</Text>
                <TextInput
                  value={editVisitedAt}
                  onChangeText={setEditVisitedAt}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#89928D"
                  style={styles.modalInput}
                />

                <Text style={styles.fieldLabel}>Visibility</Text>
                <View style={styles.optionsWrap}>
                  <TouchableOpacity
                    onPress={() => setEditVisibility('private')}
                    style={[
                      styles.chipButton,
                      editVisibility === 'private' && styles.chipButtonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipButtonText,
                        editVisibility === 'private' && styles.chipButtonTextSelected,
                      ]}
                    >
                      🔒 Private
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setEditVisibility('public')}
                    style={[
                      styles.chipButton,
                      editVisibility === 'public' && styles.chipButtonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipButtonText,
                        editVisibility === 'public' && styles.chipButtonTextSelected,
                      ]}
                    >
                      🌐 Public
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>Notes & Experience</Text>
                <TextInput
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Atmosphere, seating, great memories..."
                  placeholderTextColor="#89928D"
                  multiline
                  numberOfLines={3}
                  style={[styles.modalInput, styles.multilineInput]}
                />

                <Text style={styles.fieldLabel}>Tags (comma-separated)</Text>
                <TextInput
                  value={editTagsInput}
                  onChangeText={setEditTagsInput}
                  placeholder="e.g. coffee, outdoor, baner"
                  placeholderTextColor="#89928D"
                  style={styles.modalInput}
                />

                {/* Photos Section */}
                <View style={styles.photoManagementSection}>
                  <Text style={styles.fieldLabel}>📷 Attached Photos</Text>

                  {/* Existing Photos */}
                  {editingVisit.photos && editingVisit.photos.length > 0 ? (
                    <View style={styles.photoThumbGrid}>
                      {editingVisit.photos.map((p: any, idx: number) => {
                        const url = typeof p === 'string' ? p : p.url || p.storage_path;
                        return (
                          <View key={idx} style={styles.photoWrapper}>
                            <Image source={{ uri: url }} style={styles.editThumb} />
                            <TouchableOpacity
                              onPress={() => handleDeletePhoto(url)}
                              style={styles.photoDeleteBadge}
                            >
                              <Text style={styles.photoDeleteText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.noPhotosText}>No photos attached yet.</Text>
                  )}

                  {/* Pick New Photo */}
                  <View style={styles.photoPickerRow}>
                    <TouchableOpacity
                      onPress={handleSelectPhoto}
                      style={styles.pickPhotoButton}
                    >
                      <Text style={styles.pickPhotoButtonText}>
                        {selectedUploadPhoto ? 'Change Photo' : '+ Select Photo (5MB Max)'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {selectedUploadPhoto && (
                    <View style={styles.previewBox}>
                      <Image source={{ uri: selectedUploadPhoto.uri }} style={styles.previewImage} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.previewFileName} numberOfLines={1}>
                          {selectedUploadPhoto.name}
                        </Text>
                        <TextInput
                          value={photoCaption}
                          onChangeText={setPhotoCaption}
                          placeholder="Add photo caption..."
                          placeholderTextColor="#89928D"
                          style={styles.captionInput}
                        />
                        <TouchableOpacity
                          onPress={handleUploadPhoto}
                          disabled={uploadingPhoto}
                          style={styles.uploadBtn}
                        >
                          {uploadingPhoto ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.uploadBtnText}>Upload Photo</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity
                    onPress={() => setEditingVisit(null)}
                    style={styles.modalCancelBtn}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveEdit}
                    disabled={savingEdit}
                    style={styles.modalSaveBtn}
                  >
                    {savingEdit ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalSaveText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F5EE' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F5EE' },
  scrollContent: { padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#273C3A' },
  subtitle: { fontSize: 12, color: '#89928D', marginTop: 2 },
  searchBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E8E7DF',
    marginTop: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, fontSize: 13, color: '#273C3A' },
  clearBtn: { padding: 4 },
  clearBtnText: { color: '#89928D', fontSize: 14, fontWeight: '700' },
  interpretationBox: {
    backgroundColor: '#E8EFEF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#25454220',
  },
  interpretationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  interpretationTitle: { fontSize: 12, fontWeight: '800', color: '#254542' },
  confidenceText: {
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: '#254542',
    color: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#25454230',
  },
  filterChipText: { fontSize: 11, fontWeight: '600', color: '#254542' },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 12, color: '#89928D' },
  errorBox: {
    backgroundColor: '#FDE8E8',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F8B4B4',
    alignItems: 'center',
    marginVertical: 15,
  },
  errorText: { color: '#9B1C1C', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    backgroundColor: '#254542',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  retryBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#273C3A' },
  emptySubtitle: { fontSize: 12, color: '#89928D', textAlign: 'center', marginTop: 4, lineHeight: 18 },
  visitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E7DF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  placeName: { fontSize: 16, fontWeight: '800', color: '#273C3A' },
  date: { fontSize: 11, color: '#89928D', marginTop: 2 },
  actionButtonsRow: { flexDirection: 'row', gap: 6 },
  actionBtn: { padding: 4 },
  actionBtnText: { fontSize: 15 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 10 },
  pill: { backgroundColor: '#E8EFEF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pillText: { fontSize: 11, fontWeight: '700', color: '#254542' },
  notes: {
    fontSize: 12,
    color: '#273C3A',
    fontStyle: 'italic',
    backgroundColor: '#F8F5EE',
    padding: 10,
    borderRadius: 12,
    marginVertical: 4,
  },
  photosScroll: { marginTop: 10 },
  thumbnailPhoto: { width: 70, height: 70, borderRadius: 12, marginRight: 8 },
  unauthCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  unauthEmoji: { fontSize: 48, marginBottom: 15 },
  unauthTitle: { fontSize: 20, fontWeight: '800', color: '#273C3A', textAlign: 'center' },
  unauthSubtitle: {
    fontSize: 13,
    color: '#89928D',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 18,
  },
  signInButton: {
    backgroundColor: '#254542',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  signInButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#273C3A' },
  modalCloseText: { fontSize: 18, color: '#89928D', fontWeight: '700' },
  modalErrorBox: {
    backgroundColor: '#FDE8E8',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  modalErrorText: { color: '#9B1C1C', fontSize: 12, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#273C3A', marginTop: 12, marginBottom: 6 },
  modalInput: {
    backgroundColor: '#F8F5EE',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#273C3A',
    borderWidth: 1,
    borderColor: '#E8E7DF',
  },
  multilineInput: { minHeight: 70, textAlignVertical: 'top' },
  ratingRow: { flexDirection: 'row', gap: 6 },
  ratingButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E7DF',
    alignItems: 'center',
    backgroundColor: '#F8F5EE',
  },
  ratingButtonSelected: { backgroundColor: '#254542', borderColor: '#254542' },
  ratingButtonText: { fontSize: 12, fontWeight: '700', color: '#89928D' },
  ratingButtonTextSelected: { color: '#FFFFFF' },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E7DF',
    backgroundColor: '#F8F5EE',
  },
  chipButtonSelected: { backgroundColor: '#254542', borderColor: '#254542' },
  chipButtonText: { fontSize: 11, fontWeight: '600', color: '#273C3A' },
  chipButtonTextSelected: { color: '#FFFFFF' },
  photoManagementSection: { marginTop: 12, padding: 12, backgroundColor: '#F8F5EE', borderRadius: 16 },
  photoThumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  photoWrapper: { position: 'relative' },
  editThumb: { width: 60, height: 60, borderRadius: 10 },
  photoDeleteBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#E02424',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoDeleteText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  noPhotosText: { fontSize: 11, color: '#89928D', fontStyle: 'italic', marginVertical: 4 },
  photoPickerRow: { marginTop: 6 },
  pickPhotoButton: {
    backgroundColor: '#E8EFEF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#25454230',
  },
  pickPhotoButtonText: { color: '#254542', fontSize: 12, fontWeight: '700' },
  previewBox: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  previewImage: { width: 50, height: 50, borderRadius: 8 },
  previewFileName: { fontSize: 11, fontWeight: '700', color: '#273C3A' },
  captionInput: {
    fontSize: 11,
    borderBottomWidth: 1,
    borderColor: '#E8E7DF',
    paddingVertical: 2,
    marginTop: 2,
    color: '#273C3A',
  },
  uploadBtn: {
    backgroundColor: '#254542',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  uploadBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  modalButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 10 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E7DF',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 13, fontWeight: '700', color: '#89928D' },
  modalSaveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#254542',
    alignItems: 'center',
  },
  modalSaveText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});
