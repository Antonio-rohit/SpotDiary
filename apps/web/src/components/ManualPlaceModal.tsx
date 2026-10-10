'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, MapPin, Building, DollarSign } from 'lucide-react';
import { CATEGORIES, PUNE_LOCALITIES, Category, DuplicateCheckResult } from '@spotdiary/shared';
import { PlaceService } from '@/lib/placeService';

interface ManualPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaceCreated?: (placeId: string) => void;
}

export default function ManualPlaceModal({ isOpen, onClose, onPlaceCreated }: ManualPlaceModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Cafes');
  const [locality, setLocality] = useState('Baner');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [priceLevel, setPriceLevel] = useState(2);
  const [photoUrl, setPhotoUrl] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCheckResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleCheckAndSubmit = async (e: React.FormEvent, force: boolean = false) => {
    e.preventDefault();
    if (!name.trim() || name.length < 2) {
      setErrorMsg('Please enter a valid place name.');
      return;
    }
    if (!address.trim() || address.length < 5) {
      setErrorMsg('Please enter a full address.');
      return;
    }

    // Step 1: Duplicate check if not forced
    if (!force) {
      const dupCheck = await PlaceService.checkDuplicate(name, locality);
      if (dupCheck.isDuplicate && dupCheck.matchedPlace) {
        setDuplicateWarning(dupCheck);
        return;
      }
    }

    // Step 2: Create new place
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const createdPlace = await PlaceService.createManualPlace({
        provider: 'manual',
        name,
        category,
        locality,
        address,
        city: 'Pune',
        description,
        price_level: priceLevel,
        verification_status: 'user_submitted',
        image_urls: photoUrl ? [photoUrl] : [
          'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000'
        ]
      });

      setIsSubmitting(false);
      setDuplicateWarning(null);
      if (onPlaceCreated) onPlaceCreated(createdPlace.id);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Failed to submit place.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl border border-[#E8E7DF] relative my-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F8F5EE] text-[#273C3A] flex items-center justify-center hover:bg-[#254542] hover:text-white transition-smooth"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-6">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#89928D] block">
            Community Place Registry
          </span>
          <h2 className="text-2xl font-bold text-[#273C3A]">Add a New Place</h2>
          <p className="text-xs text-[#89928D] mt-1">
            Register a missing cafe, bakery, or spot in Pune for memory logging.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-200">
            {errorMsg}
          </div>
        )}

        {/* Duplicate Warning Prompt */}
        {duplicateWarning && duplicateWarning.matchedPlace && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs text-amber-900">Possible Duplicate Found</h4>
                <p className="text-xs mt-1 text-amber-800">
                  {duplicateWarning.reason}
                </p>
                <div className="mt-3 p-3 rounded-xl bg-white border border-amber-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs block">{duplicateWarning.matchedPlace.name}</span>
                    <span className="text-[11px] text-gray-500">{duplicateWarning.matchedPlace.address}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onPlaceCreated && duplicateWarning.matchedPlace) {
                        onPlaceCreated(duplicateWarning.matchedPlace.id);
                      }
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#254542] text-white hover:bg-[#1C3533]"
                  >
                    Use Existing Record
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={(e) => handleCheckAndSubmit(e, true)}
                    className="text-xs font-bold underline text-amber-900 hover:text-amber-950"
                  >
                    It&apos;s a different place, create new anyway →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!duplicateWarning && (
          <form onSubmit={(e) => handleCheckAndSubmit(e, false)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#273C3A] mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-[#254542]" />
                Place Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Zen Garden Cafe"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#273C3A] mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as Category)}
                  className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#273C3A] mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#254542]" />
                  Locality (Pune)
                </label>
                <select
                  value={locality}
                  onChange={e => setLocality(e.target.value)}
                  className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
                >
                  {PUNE_LOCALITIES.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#273C3A] mb-1">
                Full Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Lane 7, North Main Road, Koregaon Park"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#273C3A] mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-[#254542]" />
                Price Range
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map(lvl => (
                  <button
                    type="button"
                    key={lvl}
                    onClick={() => setPriceLevel(lvl)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-smooth ${
                      priceLevel === lvl
                        ? 'bg-[#254542] text-white shadow-sm'
                        : 'bg-[#F8F5EE] text-[#89928D] border border-[#E8E7DF]'
                    }`}
                  >
                    {'$'.repeat(lvl)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#273C3A] mb-1">
                Description / Highlights
              </label>
              <textarea
                rows={2}
                placeholder="Brief summary of vibes, seating, or special offerings..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl p-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#273C3A] mb-1">
                Cover Photo Image URL (Optional)
              </label>
              <input
                type="text"
                placeholder="https://images.unsplash.com/..."
                value={photoUrl}
                onChange={e => setPhotoUrl(e.target.value)}
                className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-2.5 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
              />
            </div>

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
                {isSubmitting ? 'Checking & Registering...' : 'Register Place'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
