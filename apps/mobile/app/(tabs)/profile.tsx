import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { apiClient } from '../../src/api/client';
import { Collection, Place, Visit } from '@spotdiary/shared';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset';

export default function ProfileScreen() {
  const { user, isAuthenticated, loading: authLoading, login, register, logout, forgotPassword, resetPassword } = useAuth();

  // Auth Form State
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  // Authenticated Profile State
  const [stats, setStats] = useState({ visits: 0, saved: 0, collections: 0 });
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Collection Modal State
  const [collectionModalVisible, setCollectionModalVisible] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [colTitle, setColTitle] = useState('');
  const [colDescription, setColDescription] = useState('');
  const [colVisibility, setColVisibility] = useState<'public' | 'private'>('public');
  const [savingCollection, setSavingCollection] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  // Load user data and collections
  const loadUserData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingCollections(true);

    try {
      const [visitsRes, savedRes, collsRes] = await Promise.allSettled([
        apiClient.get<{ visits: Visit[] }>('/api/visits'),
        apiClient.get<{ places: Place[] }>('/api/places/saved'),
        apiClient.get<{ collections: Collection[] }>('/api/collections'),
      ]);

      const visitsCount = visitsRes.status === 'fulfilled' ? visitsRes.value.visits?.length || 0 : 0;
      const savedCount = savedRes.status === 'fulfilled' ? savedRes.value.places?.length || 0 : 0;
      const loadedColls = collsRes.status === 'fulfilled' ? collsRes.value.collections || [] : [];

      setStats({
        visits: visitsCount,
        saved: savedCount,
        collections: loadedColls.length,
      });
      setCollections(loadedColls);
    } catch {
      // Non-blocking
    } finally {
      setLoadingCollections(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadUserData();
    }
  }, [isAuthenticated, loadUserData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  }, [loadUserData]);

  // Auth form submissions
  const handleAuthSubmit = async () => {
    setAuthError(null);
    setAuthSuccessMsg(null);

    if (authMode === 'signin') {
      if (!authEmail.trim() || !authPassword) {
        setAuthError('Please provide both email and password.');
        return;
      }
      setAuthSubmitting(true);
      try {
        await login(authEmail.trim(), authPassword);
      } catch (err: any) {
        setAuthError(err.message || 'Invalid credentials.');
      } finally {
        setAuthSubmitting(false);
      }
    } else if (authMode === 'signup') {
      if (!authName.trim() || !authEmail.trim() || !authPassword) {
        setAuthError('Please fill in your name, email, and password.');
        return;
      }
      if (authPassword.length < 6) {
        setAuthError('Password must be at least 6 characters.');
        return;
      }
      setAuthSubmitting(true);
      try {
        await register(authName.trim(), authEmail.trim(), authPassword);
      } catch (err: any) {
        setAuthError(err.message || 'Registration failed.');
      } finally {
        setAuthSubmitting(false);
      }
    } else if (authMode === 'forgot') {
      if (!authEmail.trim()) {
        setAuthError('Please provide your registered email address.');
        return;
      }
      setAuthSubmitting(true);
      try {
        const res = await forgotPassword(authEmail.trim());
        setAuthSuccessMsg(
          res.message || 'If an account exists, a password reset link has been dispatched.'
        );
      } catch (err: any) {
        setAuthError(err.message || 'Password recovery request failed.');
      } finally {
        setAuthSubmitting(false);
      }
    } else if (authMode === 'reset') {
      if (!authEmail.trim() || !resetToken.trim() || !authPassword) {
        setAuthError('Please provide email, reset token, and new password.');
        return;
      }
      if (authPassword.length < 6) {
        setAuthError('New password must be at least 6 characters.');
        return;
      }
      setAuthSubmitting(true);
      try {
        const res = await resetPassword(resetToken.trim(), authPassword);
        setAuthSuccessMsg(res.message || 'Password successfully reset! You can now sign in.');
        setAuthMode('signin');
        setAuthPassword('');
      } catch (err: any) {
        setAuthError(err.message || 'Password reset failed.');
      } finally {
        setAuthSubmitting(false);
      }
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of SpotDiary?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          setStats({ visits: 0, saved: 0, collections: 0 });
          setCollections([]);
        },
      },
    ]);
  };

  // Collection CRUD
  const openCreateCollectionModal = () => {
    setEditingCollection(null);
    setColTitle('');
    setColDescription('');
    setColVisibility('public');
    setCollectionError(null);
    setCollectionModalVisible(true);
  };

  const openEditCollectionModal = (col: Collection) => {
    setEditingCollection(col);
    setColTitle(col.title);
    setColDescription(col.description || '');
    setColVisibility(col.visibility || 'public');
    setCollectionError(null);
    setCollectionModalVisible(true);
  };

  const handleSaveCollection = async () => {
    if (!colTitle.trim()) {
      setCollectionError('Collection title is required.');
      return;
    }

    setSavingCollection(true);
    setCollectionError(null);

    try {
      if (editingCollection) {
        // Edit Collection
        const res = await apiClient.put<{ success: boolean; collection: Collection }>(
          `/api/collections/${encodeURIComponent(editingCollection.id)}`,
          {
            title: colTitle.trim(),
            description: colDescription.trim(),
            visibility: colVisibility,
          }
        );
        if (res.success && res.collection) {
          setCollections((prev) =>
            prev.map((c) => (c.id === editingCollection.id ? res.collection : c))
          );
          setCollectionModalVisible(false);
        }
      } else {
        // Create Collection
        const res = await apiClient.post<{ success: boolean; collection: Collection }>(
          '/api/collections',
          {
            title: colTitle.trim(),
            description: colDescription.trim(),
            visibility: colVisibility,
            place_ids: [],
          }
        );
        if (res.success && res.collection) {
          setCollections((prev) => [res.collection, ...prev]);
          setStats((prev) => ({ ...prev, collections: prev.collections + 1 }));
          setCollectionModalVisible(false);
        }
      }
    } catch (err: any) {
      setCollectionError(err.message || 'Failed to save collection.');
    } finally {
      setSavingCollection(false);
    }
  };

  const handleDeleteCollection = (id: string, title: string) => {
    Alert.alert(
      'Delete Collection',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/api/collections/${encodeURIComponent(id)}`);
              setCollections((prev) => prev.filter((c) => c.id !== id));
              setStats((prev) => ({ ...prev, collections: Math.max(0, prev.collections - 1) }));
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message || 'Could not delete collection.');
            }
          },
        },
      ]
    );
  };

  if (authLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#254542" />
      </SafeAreaView>
    );
  }

  // Unauthenticated State: Auth Forms
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.authScrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.authHeader}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>SD</Text>
            </View>
            <Text style={styles.authMainTitle}>SpotDiary Pune</Text>
            <Text style={styles.authMainSubtitle}>
              Curate, discover, and remember Pune&apos;s finest cafes and eateries
            </Text>
          </View>

          {/* Mode Switcher Tabs */}
          <View style={styles.modeTabs}>
            <TouchableOpacity
              onPress={() => {
                setAuthMode('signin');
                setAuthError(null);
                setAuthSuccessMsg(null);
              }}
              style={[styles.modeTab, authMode === 'signin' && styles.modeTabActive]}
            >
              <Text style={[styles.modeTabText, authMode === 'signin' && styles.modeTabTextActive]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setAuthMode('signup');
                setAuthError(null);
                setAuthSuccessMsg(null);
              }}
              style={[styles.modeTab, authMode === 'signup' && styles.modeTabActive]}
            >
              <Text style={[styles.modeTabText, authMode === 'signup' && styles.modeTabTextActive]}>
                Register
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setAuthMode('forgot');
                setAuthError(null);
                setAuthSuccessMsg(null);
              }}
              style={[styles.modeTab, (authMode === 'forgot' || authMode === 'reset') && styles.modeTabActive]}
            >
              <Text
                style={[
                  styles.modeTabText,
                  (authMode === 'forgot' || authMode === 'reset') && styles.modeTabTextActive,
                ]}
              >
                Recover
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Box */}
          <View style={styles.formCard}>
            {authError && (
              <View style={styles.authErrorBox}>
                <Text style={styles.authErrorText}>{authError}</Text>
              </View>
            )}

            {authSuccessMsg && (
              <View style={styles.authSuccessBox}>
                <Text style={styles.authSuccessText}>{authSuccessMsg}</Text>
              </View>
            )}

            {authMode === 'signup' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  value={authName}
                  onChangeText={setAuthName}
                  placeholder="e.g. Rohit Sharma"
                  placeholderTextColor="#89928D"
                  style={styles.textInput}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                value={authEmail}
                onChangeText={setAuthEmail}
                placeholder="name@example.com"
                placeholderTextColor="#89928D"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.textInput}
              />
            </View>

            {authMode === 'reset' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reset Token (from email)</Text>
                <TextInput
                  value={resetToken}
                  onChangeText={setResetToken}
                  placeholder="Paste 64-char hex reset token"
                  placeholderTextColor="#89928D"
                  autoCapitalize="none"
                  style={styles.textInput}
                />
              </View>
            )}

            {authMode !== 'forgot' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {authMode === 'reset' ? 'New Password' : 'Password'}
                </Text>
                <TextInput
                  value={authPassword}
                  onChangeText={setAuthPassword}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor="#89928D"
                  secureTextEntry
                  style={styles.textInput}
                />
              </View>
            )}

            <TouchableOpacity
              onPress={handleAuthSubmit}
              disabled={authSubmitting}
              style={styles.submitBtn}
            >
              {authSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {authMode === 'signin'
                    ? 'Sign In'
                    : authMode === 'signup'
                    ? 'Create Account'
                    : authMode === 'forgot'
                    ? 'Send Reset Link'
                    : 'Set New Password'}
                </Text>
              )}
            </TouchableOpacity>

            {authMode === 'forgot' && (
              <TouchableOpacity
                onPress={() => setAuthMode('reset')}
                style={styles.switchAuthLink}
              >
                <Text style={styles.switchAuthLinkText}>
                  Already have a reset token? Enter Token
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Authenticated State: Profile & Collections
  const displayName = user?.display_name || user?.name || user?.username || 'Explorer';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'SD';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#254542']} />}
      >
        {/* User Profile Card */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.handle}>{user?.email}</Text>
          {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

          {/* Stats Bar */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.visits}</Text>
              <Text style={styles.statLabel}>Visits</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.saved}</Text>
              <Text style={styles.statLabel}>Saved</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.collections}</Text>
              <Text style={styles.statLabel}>Collections</Text>
            </View>
          </View>

          {/* Logout Button */}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Collections Section */}
        <View style={styles.collectionsSection}>
          <View style={styles.collectionsHeader}>
            <View>
              <Text style={styles.sectionTitle}>My Collections</Text>
              <Text style={styles.sectionSubtitle}>Themed lists & curated trails in Pune</Text>
            </View>
            <TouchableOpacity onPress={openCreateCollectionModal} style={styles.newColBtn}>
              <Text style={styles.newColBtnText}>+ New</Text>
            </TouchableOpacity>
          </View>

          {loadingCollections && (
            <View style={styles.colLoadingContainer}>
              <ActivityIndicator size="small" color="#254542" />
            </View>
          )}

          {!loadingCollections && collections.length === 0 && (
            <View style={styles.emptyColBox}>
              <Text style={styles.emptyColEmoji}>📂</Text>
              <Text style={styles.emptyColTitle}>No Collections Yet</Text>
              <Text style={styles.emptyColSubtitle}>
                Create themed lists like &ldquo;Best Specialty Coffee&rdquo; or &ldquo;Romantic Date Spots&rdquo;.
              </Text>
            </View>
          )}

          {!loadingCollections &&
            collections.map((col) => {
              const placeCount = col.place_ids?.length || (col as any).places_count || 0;
              const isOwner = !col.user_id || col.user_id === user?.id;

              return (
                <View key={col.id} style={styles.colCard}>
                  <View style={styles.colTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.colTitle}>{col.title}</Text>
                      {col.description ? (
                        <Text style={styles.colDesc} numberOfLines={2}>
                          {col.description}
                        </Text>
                      ) : null}
                    </View>
                    {isOwner && (
                      <View style={styles.colActionBtns}>
                        <TouchableOpacity
                          onPress={() => openEditCollectionModal(col)}
                          style={styles.colActionBtn}
                        >
                          <Text style={{ fontSize: 14 }}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteCollection(col.id, col.title)}
                          style={styles.colActionBtn}
                        >
                          <Text style={{ fontSize: 14 }}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  <View style={styles.colFooter}>
                    <View style={styles.colBadge}>
                      <Text style={styles.colBadgeText}>📍 {placeCount} places</Text>
                    </View>
                    <View
                      style={[
                        styles.colBadge,
                        {
                          backgroundColor:
                            col.visibility === 'private' ? '#F0EBE0' : '#E8EFEF',
                        },
                      ]}
                    >
                      <Text style={styles.colBadgeText}>
                        {col.visibility === 'private' ? '🔒 Private' : '🌐 Public'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Collection Create/Edit Modal */}
      {collectionModalVisible && (
        <Modal visible={true} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingCollection ? 'Edit Collection' : 'Create Collection'}
                </Text>
                <TouchableOpacity onPress={() => setCollectionModalVisible(false)}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {collectionError && (
                <View style={styles.modalErrorBox}>
                  <Text style={styles.modalErrorText}>{collectionError}</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>Collection Title</Text>
              <TextInput
                value={colTitle}
                onChangeText={setColTitle}
                placeholder="e.g. Top Baner Coffee Stops"
                placeholderTextColor="#89928D"
                style={styles.modalInput}
              />

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                value={colDescription}
                onChangeText={setColDescription}
                placeholder="What is this collection about?"
                placeholderTextColor="#89928D"
                multiline
                numberOfLines={3}
                style={[styles.modalInput, styles.multilineInput]}
              />

              <Text style={styles.fieldLabel}>Visibility</Text>
              <View style={styles.optionsWrap}>
                <TouchableOpacity
                  onPress={() => setColVisibility('public')}
                  style={[
                    styles.chipButton,
                    colVisibility === 'public' && styles.chipButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipButtonText,
                      colVisibility === 'public' && styles.chipButtonTextSelected,
                    ]}
                  >
                    🌐 Public (Visible to Pune community)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setColVisibility('private')}
                  style={[
                    styles.chipButton,
                    colVisibility === 'private' && styles.chipButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipButtonText,
                      colVisibility === 'private' && styles.chipButtonTextSelected,
                    ]}
                  >
                    🔒 Private (Only visible to you)
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  onPress={() => setCollectionModalVisible(false)}
                  style={styles.modalCancelBtn}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveCollection}
                  disabled={savingCollection}
                  style={styles.modalSaveBtn}
                >
                  {savingCollection ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSaveText}>
                      {editingCollection ? 'Save Changes' : 'Create'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
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
  authScrollContent: { padding: 24, justifyContent: 'center' },
  authHeader: { alignItems: 'center', marginTop: 30, marginBottom: 25 },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#254542',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoBadgeText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  authMainTitle: { fontSize: 24, fontWeight: '800', color: '#273C3A' },
  authMainSubtitle: { fontSize: 12, color: '#89928D', textAlign: 'center', marginTop: 4, maxWidth: 280 },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E8E7DF',
    marginBottom: 20,
  },
  modeTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  modeTabActive: { backgroundColor: '#254542' },
  modeTabText: { fontSize: 12, fontWeight: '700', color: '#89928D' },
  modeTabTextActive: { color: '#FFFFFF' },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8E7DF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  authErrorBox: {
    backgroundColor: '#FDE8E8',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  authErrorText: { color: '#9B1C1C', fontSize: 12, fontWeight: '600' },
  authSuccessBox: {
    backgroundColor: '#DEF7EC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  authSuccessText: { color: '#03543F', fontSize: 12, fontWeight: '600' },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#273C3A', marginBottom: 6 },
  textInput: {
    backgroundColor: '#F8F5EE',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#273C3A',
    borderWidth: 1,
    borderColor: '#E8E7DF',
  },
  submitBtn: {
    backgroundColor: '#254542',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  switchAuthLink: { marginTop: 14, alignItems: 'center' },
  switchAuthLinkText: { color: '#254542', fontSize: 12, fontWeight: '700' },
  profileHeader: { alignItems: 'center', paddingVertical: 10 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#254542',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: '#273C3A' },
  handle: { fontSize: 12, color: '#89928D', marginTop: 2 },
  bio: { fontSize: 13, color: '#273C3A', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E8E7DF',
  },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '800', color: '#254542' },
  statLabel: { fontSize: 11, color: '#89928D', fontWeight: '600', marginTop: 2 },
  logoutBtn: {
    marginTop: 16,
    backgroundColor: '#F8F5EE',
    borderWidth: 1,
    borderColor: '#E8E7DF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 14,
  },
  logoutBtnText: { color: '#E02424', fontSize: 12, fontWeight: '700' },
  collectionsSection: { marginTop: 25 },
  collectionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#273C3A' },
  sectionSubtitle: { fontSize: 11, color: '#89928D', marginTop: 1 },
  newColBtn: {
    backgroundColor: '#254542',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  newColBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  colLoadingContainer: { padding: 20, alignItems: 'center' },
  emptyColBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E7DF',
  },
  emptyColEmoji: { fontSize: 32, marginBottom: 6 },
  emptyColTitle: { fontSize: 14, fontWeight: '700', color: '#273C3A' },
  emptyColSubtitle: { fontSize: 11, color: '#89928D', textAlign: 'center', marginTop: 4 },
  colCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E7DF',
  },
  colTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  colTitle: { fontSize: 15, fontWeight: '800', color: '#273C3A' },
  colDesc: { fontSize: 12, color: '#89928D', marginTop: 3, lineHeight: 16 },
  colActionBtns: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  colActionBtn: { padding: 4 },
  colFooter: { flexDirection: 'row', gap: 8, marginTop: 10 },
  colBadge: {
    backgroundColor: '#E8EFEF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  colBadgeText: { fontSize: 11, fontWeight: '700', color: '#254542' },
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
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#273C3A', marginTop: 10, marginBottom: 6 },
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
  multilineInput: { minHeight: 60, textAlignVertical: 'top' },
  optionsWrap: { flexDirection: 'column', gap: 8 },
  chipButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E7DF',
    backgroundColor: '#F8F5EE',
  },
  chipButtonSelected: { backgroundColor: '#254542', borderColor: '#254542' },
  chipButtonText: { fontSize: 12, fontWeight: '600', color: '#273C3A' },
  chipButtonTextSelected: { color: '#FFFFFF' },
  modalButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
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
