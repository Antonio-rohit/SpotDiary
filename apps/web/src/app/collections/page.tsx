'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import AddVisitModal from '@/components/AddVisitModal';
import PlaceCard from '@/components/PlaceCard';
import { Collection, Place } from '@spotdiary/shared';
import { PlaceService } from '@/lib/placeService';
import { useAuth } from '@/lib/auth/AuthContext';
import { Plus, Share2, Globe, Lock, Trash2, Edit3, X, RefreshCw } from 'lucide-react';

export default function CollectionsPage() {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [isAddVisitOpen, setIsAddVisitOpen] = useState(false);
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  
  // States
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formVisibility, setFormVisibility] = useState<'public' | 'private'>('public');
  const [formSelectedPlaceIds, setFormSelectedPlaceIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    PlaceService.getPlaces().then(setAllPlaces);
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await PlaceService.getCollections();
      setCollections(data);
      if (data.length > 0) {
        // Keep selected if still present, else pick first
        setSelectedCollection((prev) => {
          const matched = data.find((c) => c.id === prev?.id);
          return matched || data[0];
        });
      } else {
        setSelectedCollection(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load collections from server.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setFormTitle('');
    setFormDesc('');
    setFormVisibility('public');
    setFormSelectedPlaceIds([]);
    setModalError(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (coll: Collection) => {
    setFormTitle(coll.title);
    setFormDesc(coll.description || '');
    setFormVisibility(coll.visibility || 'public');
    setFormSelectedPlaceIds(coll.place_ids || coll.places?.map((p) => p.id) || []);
    setModalError(null);
    setIsEditModalOpen(true);
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setModalError('Collection title is required.');
      return;
    }
    setSubmitting(true);
    setModalError(null);

    try {
      const created = await PlaceService.createCollection(
        formTitle,
        formDesc,
        formSelectedPlaceIds,
        formVisibility
      );
      setIsCreateModalOpen(false);
      await loadData();
      if (created) setSelectedCollection(created);
    } catch (err: any) {
      setModalError(err.message || 'Failed to create collection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollection || !formTitle.trim()) return;
    setSubmitting(true);
    setModalError(null);

    try {
      const updated = await PlaceService.updateCollection(selectedCollection.id, {
        title: formTitle,
        description: formDesc,
        visibility: formVisibility,
        place_ids: formSelectedPlaceIds,
      });
      setIsEditModalOpen(false);
      await loadData();
      if (updated) setSelectedCollection(updated);
    } catch (err: any) {
      setModalError(err.message || 'Failed to update collection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCollection = async (id: string) => {
    if (confirm('Are you sure you want to delete this collection?')) {
      const success = await PlaceService.deleteCollection(id);
      if (success) {
        setSelectedCollection(null);
        await loadData();
      } else {
        alert('Failed to delete collection. Make sure you own this record.');
      }
    }
  };

  const isOwner = selectedCollection && user && selectedCollection.user_id === user.id;

  return (
    <div className="min-h-screen bg-[#F8F5EE]">
      <Navbar onOpenAddVisit={() => setIsAddVisitOpen(true)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#89928D] block">
              Curated Guides
            </span>
            <h1 className="text-3xl font-extrabold text-[#273C3A]">Community Collections</h1>
            <p className="text-xs text-[#89928D] mt-1">
              Browse themed lists of Pune cafes, date night spots, and specialty coffee.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#254542] text-white text-xs font-bold shadow-md hover:bg-[#1C3533] transition-smooth"
          >
            <Plus className="w-4 h-4" />
            <span>Create Collection</span>
          </button>
        </div>

        {/* Error / Retry Banner */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs font-semibold text-rose-700 flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              onClick={loadData}
              className="flex items-center gap-1 text-[#254542] underline font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Collections Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-36 rounded-3xl bg-white/60 animate-pulse border border-[#E8E7DF]"
              />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-[#E8E7DF]">
            <span className="text-4xl block mb-2">📚</span>
            <h3 className="font-bold text-lg text-[#273C3A]">No collections created yet</h3>
            <p className="text-xs text-[#89928D] mt-1 mb-4">
              Be the first to create a curated guide of Pune places!
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="px-6 py-3 rounded-full bg-[#254542] text-white font-bold text-xs shadow-md"
            >
              Create Your First Collection
            </button>
          </div>
        ) : (
          /* Collection Selector Cards Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((coll) => {
              const isSelected = selectedCollection?.id === coll.id;
              return (
                <div
                  key={coll.id}
                  onClick={() => setSelectedCollection(coll)}
                  className={`cursor-pointer rounded-3xl p-5 border transition-smooth relative ${
                    isSelected
                      ? 'bg-[#254542] text-white border-[#254542] shadow-xl scale-[1.02]'
                      : 'bg-white text-[#273C3A] border-[#E8E7DF] shadow-card hover:shadow-soft'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-[#E8EFEF] text-[#254542]'
                      }`}
                    >
                      📚
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[#F8F5EE] text-[#89928D]'
                        }`}
                      >
                        {coll.visibility === 'private' ? (
                          <Lock className="w-3 h-3" />
                        ) : (
                          <Globe className="w-3 h-3" />
                        )}
                        <span>{coll.visibility}</span>
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[#F8F5EE] text-[#89928D]'
                        }`}
                      >
                        {coll.places_count || coll.places?.length || 0} Places
                      </span>
                    </div>
                  </div>
                  <h3 className="font-bold text-lg leading-tight mb-1">{coll.title}</h3>
                  <p
                    className={`text-xs line-clamp-2 ${
                      isSelected ? 'text-white/80' : 'text-[#89928D]'
                    }`}
                  >
                    {coll.description || 'No description provided.'}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Collection Places Details */}
        {selectedCollection && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E8E7DF] shadow-card space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E8E7DF] pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#254542]">
                    Selected Guide
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F8F5EE] border border-[#E8E7DF] text-[#89928D] flex items-center gap-1">
                    {selectedCollection.visibility === 'private' ? (
                      <Lock className="w-3 h-3 text-[#254542]" />
                    ) : (
                      <Globe className="w-3 h-3 text-emerald-600" />
                    )}
                    {selectedCollection.visibility}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-[#273C3A]">{selectedCollection.title}</h2>
                <p className="text-xs text-[#89928D] mt-0.5">{selectedCollection.description}</p>
              </div>

              <div className="flex items-center gap-2">
                {isOwner && (
                  <>
                    <button
                      onClick={() => handleOpenEditModal(selectedCollection)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F8F5EE] border border-[#E8E7DF] text-[#254542] text-xs font-bold hover:bg-[#254542] hover:text-white transition-smooth"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteCollection(selectedCollection.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-100 transition-smooth"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Shareable collection link copied to clipboard!');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F8F5EE] border border-[#E8E7DF] text-[#254542] text-xs font-bold hover:bg-[#254542] hover:text-white transition-smooth"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              </div>
            </div>

            {selectedCollection.places && selectedCollection.places.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {selectedCollection.places.map((place) => (
                  <PlaceCard key={place.id} place={place} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs font-semibold text-[#89928D]">
                No places added to this collection yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create / Edit Collection Modal */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl border border-[#E8E7DF] relative">
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                setIsEditModalOpen(false);
              }}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F8F5EE] text-[#273C3A] flex items-center justify-center hover:bg-[#254542] hover:text-white transition-smooth"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-2xl font-bold text-[#273C3A] mb-1">
              {isCreateModalOpen ? 'New Collection' : 'Edit Collection'}
            </h2>
            <p className="text-xs text-[#89928D] mb-4">
              {isCreateModalOpen
                ? 'Create a persistent curated list of places in Pune.'
                : 'Update title, description, visibility, and included places.'}
            </p>

            {modalError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-200">
                {modalError}
              </div>
            )}

            <form
              onSubmit={isCreateModalOpen ? handleCreateCollection : handleUpdateCollection}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-[#273C3A] mb-1">Collection Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Best Cold Coffee in Pune"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#273C3A] mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="What makes this list special?"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl p-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#273C3A] mb-1">Visibility</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormVisibility('public')}
                    className={`py-2.5 px-4 rounded-2xl text-xs font-bold border flex items-center justify-center gap-2 transition-smooth ${
                      formVisibility === 'public'
                        ? 'bg-[#254542] text-white border-[#254542]'
                        : 'bg-[#F8F5EE] text-[#89928D] border-[#E8E7DF]'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Public</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormVisibility('private')}
                    className={`py-2.5 px-4 rounded-2xl text-xs font-bold border flex items-center justify-center gap-2 transition-smooth ${
                      formVisibility === 'private'
                        ? 'bg-[#254542] text-white border-[#254542]'
                        : 'bg-[#F8F5EE] text-[#89928D] border-[#E8E7DF]'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Private</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#273C3A] mb-1">Include Places</label>
                <div className="max-h-40 overflow-y-auto space-y-2 border border-[#E8E7DF] p-3 rounded-2xl bg-[#F8F5EE]">
                  {allPlaces.map((p) => {
                    const selected = formSelectedPlaceIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 text-xs font-medium cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            if (selected) {
                              setFormSelectedPlaceIds(
                                formSelectedPlaceIds.filter((id) => id !== p.id)
                              );
                            } else {
                              setFormSelectedPlaceIds([...formSelectedPlaceIds, p.id]);
                            }
                          }}
                          className="rounded text-[#254542] focus:ring-[#254542]"
                        />
                        <span>
                          {p.name} ({p.locality})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-5 py-3 rounded-2xl text-xs font-bold text-[#89928D]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-2xl text-xs font-bold text-white bg-[#254542] hover:bg-[#1C3533] disabled:opacity-50"
                >
                  {submitting
                    ? 'Saving...'
                    : isCreateModalOpen
                    ? 'Save Collection'
                    : 'Update Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AddVisitModal
        isOpen={isAddVisitOpen}
        onClose={() => setIsAddVisitOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
}
