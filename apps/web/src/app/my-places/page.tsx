'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import AddVisitModal from '@/components/AddVisitModal';
import PlaceCard from '@/components/PlaceCard';
import { Visit, Place, NaturalLanguageInterpretation, PeopleContext, Visibility } from '@spotdiary/shared';
import { PlaceService } from '@/lib/placeService';
import { 
  BookMarked, Heart, Search, Sparkles, Star, 
  Trash2, Edit3, Lock, Globe, BrainCircuit, X, Upload, Camera, AlertCircle
} from 'lucide-react';

export default function MyPlacesPage() {
  const [activeTab, setActiveTab] = useState<'visits' | 'saved'>('visits');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isNLMode, setIsNLMode] = useState(true);
  const [nlInterpretation, setNlInterpretation] = useState<NaturalLanguageInterpretation | null>(null);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPeopleContext, setSelectedPeopleContext] = useState('All');
  const [selectedLocality, setSelectedLocality] = useState('All');

  const [isAddVisitOpen, setIsAddVisitOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit Visit Modal State
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [editBestItem, setEditBestItem] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editRating, setEditRating] = useState(5);
  const [editPeopleContext, setEditPeopleContext] = useState<PeopleContext>('Solo');
  const [editVisitedAt, setEditVisitedAt] = useState('');
  const [editVisibility, setEditVisibility] = useState<Visibility>('private');
  const [editTagsInput, setEditTagsInput] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    if (activeTab === 'visits') {
      const result = await PlaceService.searchMemory({
        query: searchQuery,
        category: selectedCategory as any,
        peopleContext: selectedPeopleContext as any,
        locality: selectedLocality
      }, isNLMode);
      setVisits(result.visits);
      setNlInterpretation(result.interpretation);
    } else {
      const saved = await PlaceService.getSavedPlaces();
      setSavedPlaces(saved);
    }
    setLoading(false);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await PlaceService.searchMemory({
      query: searchQuery,
      category: selectedCategory as any,
      peopleContext: selectedPeopleContext as any,
      locality: selectedLocality
    }, isNLMode);
    setVisits(result.visits);
    setNlInterpretation(result.interpretation);
    setLoading(false);
  };

  const handleDeleteVisit = async (id: string) => {
    if (confirm('Delete this visit memory record?')) {
      const success = await PlaceService.deleteVisit(id);
      if (success) {
        loadData();
      } else {
        alert('Failed to delete visit record.');
      }
    }
  };

  const handleOpenEditModal = (visit: Visit) => {
    setEditingVisit(visit);
    setEditBestItem(visit.best_item);
    setEditNotes(visit.notes || '');
    setEditRating(visit.rating);
    setEditPeopleContext(visit.people_context);
    setEditVisitedAt(visit.visited_at ? visit.visited_at.substring(0, 10) : new Date().toISOString().substring(0, 10));
    setEditVisibility(visit.visibility || 'private');
    setEditTagsInput((visit.tags || []).join(', '));
    setEditError(null);
    setPhotoError(null);
  };

  const handleSaveVisitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVisit) return;

    if (!editBestItem.trim()) {
      setEditError('Best item is required.');
      return;
    }

    setSubmittingEdit(true);
    setEditError(null);

    try {
      const tagsArray = editTagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter((t) => t.length > 0);

      const updated = await PlaceService.updateVisit(editingVisit.id, {
        best_item: editBestItem,
        notes: editNotes,
        rating: editRating,
        people_context: editPeopleContext,
        visited_at: new Date(editVisitedAt).toISOString(),
        visibility: editVisibility,
        tags: tagsArray,
      });

      if (updated) {
        setEditingVisit(null);
        await loadData();
      } else {
        setEditError('Failed to update visit record.');
      }
    } catch (err: any) {
      setEditError(err.message || 'Error updating visit.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingVisit || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setUploadingPhoto(true);
    setPhotoError(null);

    try {
      const uploadResult = await PlaceService.uploadVisitPhoto(editingVisit.id, file);
      if (uploadResult && uploadResult.url) {
        const currentPhotos = editingVisit.photos || [];
        const updatedVisit = {
          ...editingVisit,
          photos: [...currentPhotos, { id: uploadResult.id, visit_id: editingVisit.id, user_id: editingVisit.user_id, storage_path: uploadResult.url, url: uploadResult.url, created_at: new Date().toISOString() }],
        };
        setEditingVisit(updatedVisit as any);
        await loadData();
      }
    } catch (err: any) {
      setPhotoError(err.message || 'Photo upload failed.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = async (photoUrl: string) => {
    if (!editingVisit) return;
    try {
      await PlaceService.deleteVisitPhoto(editingVisit.id, photoUrl);
      const updatedPhotos = (editingVisit.photos || []).filter((p: any) => (p.url || p) !== photoUrl);
      setEditingVisit({
        ...editingVisit,
        photos: updatedPhotos as any,
      });
      await loadData();
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to remove photograph.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F5EE]">
      <Navbar onOpenAddVisit={() => setIsAddVisitOpen(true)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#89928D] block">
              Personal Dashboard
            </span>
            <h1 className="text-3xl font-extrabold text-[#273C3A]">My Places & Visit Memories</h1>
            <p className="text-xs text-[#89928D] mt-1">
              Search past orders, dates, notes, photos, and saved wishlist spots in Pune.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-white border border-[#E8E7DF] rounded-full p-1 shadow-sm">
            <button
              onClick={() => setActiveTab('visits')}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold transition-smooth ${
                activeTab === 'visits' ? 'bg-[#254542] text-white shadow-sm' : 'text-[#89928D] hover:text-[#273C3A]'
              }`}
            >
              <BookMarked className="w-4 h-4" />
              <span>Visit History</span>
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold transition-smooth ${
                activeTab === 'saved' ? 'bg-[#254542] text-white shadow-sm' : 'text-[#89928D] hover:text-[#273C3A]'
              }`}
            >
              <Heart className="w-4 h-4" />
              <span>Saved Wishlist</span>
            </button>
          </div>
        </div>

        {/* Personal Memory Search Engine Section */}
        {activeTab === 'visits' && (
          <div className="bg-white rounded-3xl p-6 border border-[#E8E7DF] shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-[#254542]" />
                <h2 className="text-sm font-bold text-[#273C3A]">Personal Memory Search</h2>
              </div>

              {/* Natural Language Mode Switch */}
              <button
                type="button"
                onClick={() => setIsNLMode(!isNLMode)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-smooth ${
                  isNLMode ? 'bg-[#AAB69A] text-[#254542]' : 'bg-[#F8F5EE] text-[#89928D] border border-[#E8E7DF]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isNLMode ? 'NL Query Parsing Enabled' : 'Structured Mode'}</span>
              </button>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#89928D]" />
                <input
                  type="text"
                  placeholder={
                    isNLMode
                      ? 'e.g. Find the cafe where I had cold coffee with my girlfriend in Baner'
                      : 'Search by food item, tag, note or place name...'
                  }
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl pl-11 pr-4 py-3.5 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3.5 rounded-2xl bg-[#254542] text-white font-bold text-xs shadow-sm hover:bg-[#1C3533] transition-smooth flex-shrink-0"
              >
                Search Memory
              </button>
            </form>

            {/* NL Query Interpretation Badge Display */}
            {isNLMode && nlInterpretation && searchQuery.trim().length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[#E8EFEF] border border-[#254542]/20 text-xs text-[#254542] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Interpreted Search Filters:
                  </span>
                  <span className="text-[10px] font-extrabold bg-[#254542] text-white px-2 py-0.5 rounded-full">
                    {Math.round(nlInterpretation.confidence * 100)}% Confidence
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {nlInterpretation.extractedFilters.category && (
                    <span className="bg-white border border-[#254542]/30 px-2.5 py-0.5 rounded-md font-semibold">
                      Category: {nlInterpretation.extractedFilters.category}
                    </span>
                  )}
                  {nlInterpretation.extractedFilters.locality && (
                    <span className="bg-white border border-[#254542]/30 px-2.5 py-0.5 rounded-md font-semibold">
                      Locality: {nlInterpretation.extractedFilters.locality}
                    </span>
                  )}
                  {nlInterpretation.extractedFilters.peopleContext && (
                    <span className="bg-white border border-[#254542]/30 px-2.5 py-0.5 rounded-md font-semibold">
                      With: {nlInterpretation.extractedFilters.peopleContext}
                    </span>
                  )}
                  {nlInterpretation.extractedFilters.bestItem && (
                    <span className="bg-white border border-[#254542]/30 px-2.5 py-0.5 rounded-md font-semibold">
                      Item: {nlInterpretation.extractedFilters.bestItem}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Visit History List */}
        {activeTab === 'visits' && (
          <div className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <div key={i} className="h-44 rounded-3xl bg-white/60 animate-pulse border border-[#E8E7DF]" />
                ))}
              </div>
            ) : visits.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-[#E8E7DF]">
                <span className="text-4xl block mb-2">📖</span>
                <h3 className="font-bold text-lg text-[#273C3A]">No visit records found</h3>
                <p className="text-xs text-[#89928D] mt-1 mb-4">
                  {searchQuery ? 'No matching saved visits found for your search.' : 'You haven’t logged any cafe or place visits yet.'}
                </p>
                <button
                  onClick={() => setIsAddVisitOpen(true)}
                  className="px-6 py-3 rounded-full bg-[#254542] text-white font-bold text-xs shadow-md"
                >
                  Log Your First Visit
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {visits.map(visit => (
                  <div
                    key={visit.id}
                    className="bg-white rounded-3xl p-5 md:p-6 border border-[#E8E7DF] shadow-card flex flex-col md:flex-row gap-6 justify-between"
                  >
                    <div className="space-y-3 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <Link 
                            href={`/places/${visit.place_id}`}
                            className="text-xl font-bold text-[#273C3A] hover:text-[#254542] transition-smooth"
                          >
                            {visit.place?.name || 'Saved Spot'}
                          </Link>
                          <p className="text-xs text-[#89928D] mt-0.5">
                            {visit.place?.locality ? `${visit.place.locality}, Pune • ` : ''}
                            {new Date(visit.visited_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(visit)}
                            className="text-[#89928D] hover:text-[#254542] transition-smooth p-1"
                            title="Edit Visit Record"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteVisit(visit.id)}
                            className="text-[#89928D] hover:text-rose-600 transition-smooth p-1"
                            title="Delete Visit Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Loved Item Badge */}
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8F5EE] border border-[#E8E7DF] text-xs font-bold text-[#254542]">
                        <span>☕ Best Item:</span>
                        <span>{visit.best_item}</span>
                      </div>

                      {/* Notes */}
                      {visit.notes && (
                        <p className="text-xs text-[#273C3A] bg-[#F8F5EE]/50 p-3 rounded-2xl border border-[#E8E7DF]/60 italic">
                          &ldquo;{visit.notes}&rdquo;
                        </p>
                      )}

                      {/* People Context & Tags */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#254542] text-white">
                          With: {visit.people_context}
                        </span>
                        {visit.tags?.map((t, idx) => (
                          <span key={idx} className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#AAB69A]/30 text-[#254542]">
                            #{t}
                          </span>
                        ))}
                        <span className="ml-auto text-[11px] text-[#89928D] flex items-center gap-1">
                          {visit.visibility === 'private' ? <Lock className="w-3 h-3 text-[#254542]" /> : <Globe className="w-3 h-3 text-emerald-600" />}
                          {visit.visibility}
                        </span>
                      </div>
                    </div>

                    {/* Rating & Photo Thumbnails */}
                    <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 md:border-l border-[#E8E7DF] pt-4 md:pt-0 md:pl-6 gap-4">
                      <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span className="text-xs font-bold text-amber-900">{visit.rating}/5</span>
                      </div>

                      {visit.photos && visit.photos.length > 0 && (
                        <div className="flex items-center gap-2">
                          {visit.photos.slice(0, 3).map((photo: any, pIdx: number) => {
                            const photoUrl = typeof photo === 'string' ? photo : (photo.url || photo.storage_path);
                            return (
                              <div key={pIdx} className="relative w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 border border-[#E8E7DF]">
                                <Image
                                  src={photoUrl}
                                  alt="Visit Photo"
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Saved Wishlist Places List */}
        {activeTab === 'saved' && (
          <div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-64 rounded-3xl bg-white/60 animate-pulse border border-[#E8E7DF]" />
                ))}
              </div>
            ) : savedPlaces.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-[#E8E7DF]">
                <span className="text-4xl block mb-2">♥</span>
                <h3 className="font-bold text-lg text-[#273C3A]">No saved wishlist places</h3>
                <p className="text-xs text-[#89928D] mt-1 mb-4">Click the heart icon on any place card to save it for later.</p>
                <Link href="/explore" className="px-6 py-3 rounded-full bg-[#254542] text-white font-bold text-xs">
                  Browse Pune Places
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedPlaces.map(place => (
                  <PlaceCard key={place.id} place={place} isSavedInitial={true} />
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Edit Visit Modal */}
      {editingVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl border border-[#E8E7DF] relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingVisit(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F8F5EE] text-[#273C3A] flex items-center justify-center hover:bg-[#254542] hover:text-white transition-smooth"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-2xl font-bold text-[#273C3A] mb-1">Edit Visit Record</h2>
            <p className="text-xs text-[#89928D] mb-4">
              Update notes, rating, orders, and photographs for {editingVisit.place?.name || 'this spot'}.
            </p>

            {editError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-200">
                {editError}
              </div>
            )}

            {photoError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{photoError}</span>
              </div>
            )}

            {/* Visit Photographs Management Section */}
            <div className="mb-5 p-4 rounded-2xl bg-[#F8F5EE] border border-[#E8E7DF] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#273C3A] flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-[#254542]" />
                  <span>Visit Photographs</span>
                </label>
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#254542] text-white rounded-full text-xs font-bold hover:bg-[#1C3533] transition-smooth">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingPhoto ? 'Uploading...' : 'Upload Photo'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    className="hidden"
                  />
                </label>
              </div>

              {editingVisit.photos && editingVisit.photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-3 pt-1">
                  {editingVisit.photos.map((photo: any, idx: number) => {
                    const url = typeof photo === 'string' ? photo : (photo.url || photo.storage_path);
                    return (
                      <div key={idx} className="relative h-20 rounded-xl overflow-hidden group border border-[#E8E7DF] bg-white">
                        <Image src={url} alt="Visit Photograph" fill className="object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(url)}
                          className="absolute top-1 right-1 bg-rose-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-smooth"
                          title="Remove Photograph"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-[#89928D] italic">No photographs attached yet. Maximum file size: 5MB (JPEG, PNG, WebP).</p>
              )}
            </div>

            <form onSubmit={handleSaveVisitEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#273C3A] mb-1">☕ Best Item / Order</label>
                <input
                  type="text"
                  required
                  value={editBestItem}
                  onChange={(e) => setEditBestItem(e.target.value)}
                  className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#273C3A] mb-1">Rating (1-5)</label>
                  <select
                    value={editRating}
                    onChange={(e) => setEditRating(Number(e.target.value))}
                    className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
                  >
                    <option value={5}>5 Stars ★★★★★</option>
                    <option value={4}>4 Stars ★★★★☆</option>
                    <option value={3}>3 Stars ★★★☆☆</option>
                    <option value={2}>2 Stars ★★☆☆☆</option>
                    <option value={1}>1 Star ★☆☆☆☆</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#273C3A] mb-1">People Context</label>
                  <select
                    value={editPeopleContext}
                    onChange={(e) => setEditPeopleContext(e.target.value as PeopleContext)}
                    className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
                  >
                    <option value="Solo">Solo</option>
                    <option value="Friends">Friends</option>
                    <option value="Partner">Partner</option>
                    <option value="Family">Family</option>
                    <option value="Colleagues">Colleagues</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#273C3A] mb-1">Visited Date</label>
                  <input
                    type="date"
                    required
                    value={editVisitedAt}
                    onChange={(e) => setEditVisitedAt(e.target.value)}
                    className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#273C3A] mb-1">Visibility</label>
                  <select
                    value={editVisibility}
                    onChange={(e) => setEditVisibility(e.target.value as Visibility)}
                    className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
                  >
                    <option value="private">Private 🔒</option>
                    <option value="public">Public 🌐</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#273C3A] mb-1">Notes & Experience</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Share details about the atmosphere, service, or date night..."
                  className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl p-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#273C3A] mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={editTagsInput}
                  onChange={(e) => setEditTagsInput(e.target.value)}
                  placeholder="e.g. Coffee, Outdoor, Date Night"
                  className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingVisit(null)}
                  className="px-5 py-3 rounded-2xl text-xs font-bold text-[#89928D]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-6 py-3 rounded-2xl text-xs font-bold text-white bg-[#254542] hover:bg-[#1C3533] disabled:opacity-50"
                >
                  {submittingEdit ? 'Saving...' : 'Update Visit'}
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
