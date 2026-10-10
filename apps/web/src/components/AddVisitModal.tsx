'use client';

import React, { useState, useEffect } from 'react';
import { X, Star, Calendar, UserCheck, Tag as TagIcon, Camera, Lock, Globe } from 'lucide-react';
import { PEOPLE_CONTEXT_OPTIONS, Place, PeopleContext, Visibility } from '@spotdiary/shared';
import { PlaceService } from '@/lib/placeService';

interface AddVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedPlaceId?: string;
  onSuccess?: () => void;
}

export default function AddVisitModal({
  isOpen,
  onClose,
  preselectedPlaceId,
  onSuccess
}: AddVisitModalProps) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState(preselectedPlaceId || '');
  const [visitedAt, setVisitedAt] = useState(new Date().toISOString().split('T')[0]);
  const [rating, setRating] = useState(5);
  const [bestItem, setBestItem] = useState('');
  const [notes, setNotes] = useState('');
  const [peopleContext, setPeopleContext] = useState<PeopleContext>('Partner');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Coffee', 'Cozy']);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const availableTags = ['Coffee', 'Date Night', 'Cozy', 'Outdoor Seating', 'Work Friendly', 'Desserts'];

  useEffect(() => {
    if (isOpen) {
      PlaceService.getPlaces().then(data => {
        setPlaces(data);
        if (data.length > 0 && !selectedPlaceId) {
          setSelectedPlaceId(preselectedPlaceId || data[0].id);
        }
      });
    }
  }, [isOpen, preselectedPlaceId]);

  if (!isOpen) return null;

  const toggleTag = (t: string) => {
    if (selectedTags.includes(t)) {
      setSelectedTags(selectedTags.filter(item => item !== t));
    } else {
      setSelectedTags([...selectedTags, t]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlaceId) {
      setErrorMsg('Please select a place.');
      return;
    }
    if (!bestItem.trim()) {
      setErrorMsg('Please specify what you loved (food, drink or experience).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await PlaceService.addVisit({
        place_id: selectedPlaceId,
        visited_at: new Date(visitedAt).toISOString(),
        rating,
        best_item: bestItem,
        notes,
        people_context: peopleContext,
        visibility,
        tags: selectedTags,
        photos: photoUrl ? [{
          id: `p-${Date.now()}`,
          visit_id: '',
          user_id: 'demo-user-1',
          storage_path: photoUrl,
          url: photoUrl,
          created_at: new Date().toISOString()
        }] : []
      });

      setIsSubmitting(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Failed to save visit memory.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-3xl p-6 md:p-8 shadow-2xl border border-[#E8E7DF] my-8 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F8F5EE] text-[#273C3A] flex items-center justify-center hover:bg-[#254542] hover:text-white transition-smooth"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-6">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#89928D] block">
            Digital Travel Diary
          </span>
          <h2 className="text-2xl font-bold text-[#273C3A]">Record a Visit</h2>
          <p className="text-xs text-[#89928D] mt-1">
            Save what you ordered, who you visited with, and your personal memory.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Place Selection */}
          <div>
            <label className="block text-xs font-bold text-[#273C3A] mb-1.5">
              Place Visited
            </label>
            <select
              value={selectedPlaceId}
              onChange={e => setSelectedPlaceId(e.target.value)}
              className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
            >
              {places.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.locality}, Pune)
                </option>
              ))}
            </select>
          </div>

          {/* Date & Rating Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#273C3A] mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#254542]" />
                Visit Date
              </label>
              <input
                type="date"
                value={visitedAt}
                onChange={e => setVisitedAt(e.target.value)}
                className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-2.5 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#273C3A] mb-1.5">
                Rating
              </label>
              <div className="flex items-center gap-1 bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setRating(star)}
                    className="p-1 hover:scale-125 transition-smooth"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        star <= rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-[#89928D]/40'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold ml-2 text-[#254542]">{rating}/5</span>
              </div>
            </div>
          </div>

          {/* Best Food/Drink/Experience */}
          <div>
            <label className="block text-xs font-bold text-[#273C3A] mb-1.5">
              Best Food, Drink or Experience <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Cold Coffee & Saffron Cheesecake"
              value={bestItem}
              onChange={e => setBestItem(e.target.value)}
              className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
            />
          </div>

          {/* People Context Pills */}
          <div>
            <label className="block text-xs font-bold text-[#273C3A] mb-1.5 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-[#254542]" />
              Who were you with?
            </label>
            <div className="flex flex-wrap gap-2">
              {PEOPLE_CONTEXT_OPTIONS.map(opt => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setPeopleContext(opt)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-smooth ${
                    peopleContext === opt
                      ? 'bg-[#254542] text-white shadow-sm'
                      : 'bg-[#F8F5EE] text-[#273C3A] border border-[#E8E7DF] hover:bg-white'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-[#273C3A] mb-1.5 flex items-center gap-1">
              <TagIcon className="w-3.5 h-3.5 text-[#254542]" />
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map(tag => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-smooth ${
                      active
                        ? 'bg-[#AAB69A] text-[#254542] font-bold'
                        : 'bg-[#F8F5EE] text-[#89928D] border border-[#E8E7DF]'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo URL or Upload preview */}
          <div>
            <label className="block text-xs font-bold text-[#273C3A] mb-1.5 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-[#254542]" />
              Photo URL (Optional)
            </label>
            <input
              type="text"
              placeholder="https://images.unsplash.com/..."
              value={photoUrl}
              onChange={e => setPhotoUrl(e.target.value)}
              className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-2.5 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
            />
          </div>

          {/* Personal Notes */}
          <div>
            <label className="block text-xs font-bold text-[#273C3A] mb-1.5">
              Personal Notes & Experience
            </label>
            <textarea
              rows={3}
              placeholder="Describe the vibes, seat recommendation, or memorable conversation..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl p-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
            />
          </div>

          {/* Visibility Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F8F5EE] border border-[#E8E7DF]">
            <div className="flex items-center gap-2">
              {visibility === 'private' ? (
                <Lock className="w-4 h-4 text-[#254542]" />
              ) : (
                <Globe className="w-4 h-4 text-emerald-600" />
              )}
              <div>
                <span className="text-xs font-bold text-[#273C3A] block">
                  {visibility === 'private' ? 'Private Visit' : 'Public Review'}
                </span>
                <span className="text-[11px] text-[#89928D] block">
                  {visibility === 'private' 
                    ? 'Only visible to you in your personal memory history'
                    : 'Visible on place page as community recommendation'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setVisibility(visibility === 'private' ? 'public' : 'private')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-[#E8E7DF] text-[#254542] hover:bg-[#254542] hover:text-white transition-smooth"
            >
              Switch to {visibility === 'private' ? 'Public' : 'Private'}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-2xl text-xs font-bold text-[#89928D] hover:bg-[#F8F5EE] transition-smooth"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-7 py-3 rounded-2xl text-xs font-bold text-white bg-[#254542] hover:bg-[#1C3533] shadow-md transition-smooth disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Memory...' : 'Save Visit Memory'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
