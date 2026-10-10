import { Place, Visit, DEMO_PUNE_PLACES, checkForDuplicatePlace, DuplicateCheckResult, SearchFilters, filterVisits, parseNaturalLanguageMemoryQuery, Collection } from '@spotdiary/shared';

// Place catalog cache for instant client-side rendering of public place details
let localPlaces: Place[] = [...DEMO_PUNE_PLACES];

export class PlaceService {
  /**
   * Search places via server-side Google Places API endpoint with graceful local places catalog fallback
   */
  static async getPlaces(params?: {
    category?: string;
    query?: string;
    locality?: string;
    priceLevel?: number;
  }): Promise<Place[]> {
    if (typeof window !== 'undefined') {
      try {
        const queryParams = new URLSearchParams();
        if (params?.category) queryParams.set('category', params.category);
        if (params?.query) queryParams.set('query', params.query);
        if (params?.locality) queryParams.set('locality', params.locality);

        const res = await fetch(`/api/places/search?${queryParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.places && data.places.length > 0) {
            data.places.forEach((p: Place) => {
              if (!localPlaces.some(lp => lp.id === p.id)) {
                localPlaces.push(p);
              }
            });
            return data.places;
          }
        }
      } catch (e: any) {
        console.warn('[PlaceService] Fetching Places API failed, using cached catalog fallback:', e?.message);
      }
    }

    let results = [...localPlaces];

    if (params?.category && params.category !== 'All') {
      results = results.filter(p => p.category === params.category);
    }

    if (params?.locality && params.locality !== 'All') {
      results = results.filter(p => p.locality.toLowerCase() === params.locality?.toLowerCase());
    }

    if (params?.priceLevel) {
      results = results.filter(p => p.price_level === params.priceLevel);
    }

    if (params?.query && params.query.trim().length > 0) {
      const q = params.query.trim().toLowerCase();
      results = results.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.locality.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.popular_items?.some(item => item.toLowerCase().includes(q))
      );
    }

    return results;
  }

  /**
   * Get single place by ID
   */
  static async getPlaceById(id: string): Promise<Place | null> {
    const place = localPlaces.find(p => p.id === id);
    if (place) return place;

    const fetched = await this.getPlaces();
    return fetched.find(p => p.id === id) || null;
  }

  /**
   * Check for duplicate place when user submits a new place manually
   */
  static async checkDuplicate(name: string, locality: string): Promise<DuplicateCheckResult> {
    return checkForDuplicatePlace(name, locality, localPlaces);
  }

  /**
   * Submit new manual place record
   */
  static async createManualPlace(placeData: Omit<Place, 'id' | 'created_at' | 'updated_at'>): Promise<Place> {
    const newPlace: Place = {
      ...placeData,
      id: `manual-place-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verification_status: 'user_submitted',
      rating_avg: 5.0,
      reviews_count: 1,
      image_urls: placeData.image_urls?.length ? placeData.image_urls : []
    };
    localPlaces.unshift(newPlace);
    return newPlace;
  }

  /**
   * Saved wishlist places toggle
   */
  static async toggleSavedPlace(placeId: string): Promise<boolean> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/places/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ place_id: placeId })
        });
        if (res.ok) {
          const data = await res.json();
          return !!data.saved;
        } else {
          const errData = await res.json().catch(() => ({}));
          console.error('[PlaceService] toggleSavedPlace failed:', errData.error || res.statusText);
        }
      } catch (e: any) {
        console.error('[PlaceService] toggleSavedPlace network failure:', e?.message);
      }
    }
    return false;
  }

  static async isPlaceSaved(placeId: string): Promise<boolean> {
    const saved = await this.getSavedPlaces();
    return saved.some(p => p.id === placeId);
  }

  static async getSavedPlaces(): Promise<Place[]> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/places/saved');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && Array.isArray(data.places)) {
            return data.places;
          }
        } else {
          console.error('[PlaceService] getSavedPlaces HTTP error:', res.status);
        }
      } catch (e: any) {
        console.error('[PlaceService] getSavedPlaces network failure:', e?.message);
      }
    }
    return [];
  }

  /**
   * Visits & Memory Search Service (Strictly Isolated per Authenticated User)
   */
  static async addVisit(visitData: Omit<Visit, 'id' | 'created_at' | 'updated_at' | 'user_id'>): Promise<Visit | null> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/visits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(visitData)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.visit) {
            const place = await this.getPlaceById(visitData.place_id);
            return { ...data.visit, place: place || undefined };
          }
        } else {
          const err = await res.json().catch(() => ({}));
          console.error('[PlaceService] addVisit failed:', err.error || res.statusText);
        }
      } catch (e: any) {
        console.error('[PlaceService] addVisit network failure:', e?.message);
      }
    }
    return null;
  }

  static async getUserVisits(): Promise<Visit[]> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/visits');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && Array.isArray(data.visits)) {
            const visitsWithPlaces = await Promise.all(data.visits.map(async (v: Visit) => {
              const place = await this.getPlaceById(v.place_id);
              return { ...v, place: place || v.place };
            }));
            return visitsWithPlaces;
          }
        } else {
          console.error('[PlaceService] getUserVisits error response status:', res.status);
        }
      } catch (e: any) {
        console.error('[PlaceService] getUserVisits network failure:', e?.message);
      }
    }
    return [];
  }

  static async getVisitById(id: string): Promise<Visit | null> {
    const visits = await this.getUserVisits();
    return visits.find(v => v.id === id) || null;
  }

  static async deleteVisit(id: string): Promise<boolean> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/visits?id=${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          return true;
        } else {
          const err = await res.json().catch(() => ({}));
          console.error('[PlaceService] deleteVisit failed:', err.error || res.statusText);
        }
      } catch (e: any) {
        console.error('[PlaceService] deleteVisit network failure:', e?.message);
      }
    }
    return false;
  }

  static async updateVisit(
    id: string,
    updateData: Partial<Omit<Visit, 'id' | 'user_id' | 'place_id' | 'created_at'>>
  ): Promise<Visit | null> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/visits', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...updateData }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.visit) {
            const place = await this.getPlaceById(data.visit.place_id);
            return { ...data.visit, place: place || undefined };
          }
        } else {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to update visit record');
        }
      } catch (e: any) {
        console.error('[PlaceService] updateVisit error:', e?.message);
        throw e;
      }
    }
    return null;
  }

  /**
   * Memory Search engine over the authenticated user's actual visits
   */
  static async searchMemory(filters: SearchFilters, isNaturalLanguage: boolean = false) {
    const userVisits = await this.getUserVisits();

    if (isNaturalLanguage && filters.query) {
      const nlInterpretation = parseNaturalLanguageMemoryQuery(filters.query);
      const combinedFilters: SearchFilters = {
        ...filters,
        category: nlInterpretation.extractedFilters.category || filters.category,
        locality: nlInterpretation.extractedFilters.locality || filters.locality,
        peopleContext: nlInterpretation.extractedFilters.peopleContext || filters.peopleContext,
        bestItem: nlInterpretation.extractedFilters.bestItem || filters.bestItem,
        minRating: nlInterpretation.extractedFilters.minRating || filters.minRating
      };
      const matchedVisits = filterVisits(userVisits, combinedFilters);
      return {
        visits: matchedVisits,
        interpretation: nlInterpretation
      };
    } else {
      const matchedVisits = filterVisits(userVisits, filters);
      return {
        visits: matchedVisits,
        interpretation: null
      };
    }
  }

  /**
   * Community Recommendations & Collections (MongoDB Backed)
   */
  static async getCollections(): Promise<Collection[]> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/collections');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.collections)) {
            // Populate full place details for each collection
            const collectionsWithPlaces = await Promise.all(
              data.collections.map(async (coll: Collection) => {
                const placeIds = coll.place_ids || [];
                const places = await Promise.all(placeIds.map((pId: string) => this.getPlaceById(pId)));
                const validPlaces = places.filter(Boolean) as Place[];
                return {
                  ...coll,
                  places: validPlaces,
                  places_count: placeIds.length,
                  cover_image: validPlaces[0]?.image_urls?.[0],
                };
              })
            );
            return collectionsWithPlaces;
          }
        }
      } catch (e: any) {
        console.error('[PlaceService] getCollections error:', e?.message);
      }
    }
    return [];
  }

  static async getCollectionById(id: string): Promise<Collection | null> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/collections/${encodeURIComponent(id)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.collection) {
            const placeIds = data.collection.place_ids || [];
            const places = await Promise.all(placeIds.map((pId: string) => this.getPlaceById(pId)));
            const validPlaces = places.filter(Boolean) as Place[];
            return {
              ...data.collection,
              places: validPlaces,
              places_count: placeIds.length,
              cover_image: validPlaces[0]?.image_urls?.[0],
            };
          }
        }
      } catch (e: any) {
        console.error('[PlaceService] getCollectionById error:', e?.message);
      }
    }
    return null;
  }

  static async createCollection(
    title: string,
    description: string,
    placeIds: string[],
    visibility: 'public' | 'private' = 'public'
  ): Promise<Collection | null> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            place_ids: placeIds,
            visibility,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.collection) {
            return await this.getCollectionById(data.collection.id);
          }
        } else {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create collection');
        }
      } catch (e: any) {
        console.error('[PlaceService] createCollection error:', e?.message);
        throw e;
      }
    }
    return null;
  }

  static async updateCollection(
    id: string,
    updateData: { title?: string; description?: string; place_ids?: string[]; visibility?: 'public' | 'private' }
  ): Promise<Collection | null> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/collections/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.collection) {
            return await this.getCollectionById(data.collection.id);
          }
        } else {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to update collection');
        }
      } catch (e: any) {
        console.error('[PlaceService] updateCollection error:', e?.message);
        throw e;
      }
    }
    return null;
  }

  static async deleteCollection(id: string): Promise<boolean> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/collections/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          return true;
        } else {
          const err = await res.json().catch(() => ({}));
          console.error('[PlaceService] deleteCollection error:', err.error || res.statusText);
        }
      } catch (e: any) {
        console.error('[PlaceService] deleteCollection network error:', e?.message);
      }
    }
    return false;
  }

  /**
   * "What people love here" section calculator
   */
  static async getWhatPeopleLove(placeId: string): Promise<string[]> {
    const place = await this.getPlaceById(placeId);
    return place?.popular_items ? Array.from(new Set(place.popular_items)) : [];
  }

  /**
   * Visit Photograph Upload & Removal Helpers
   */
  static async uploadVisitPhoto(visitId: string, file: File, caption?: string): Promise<{ url: string; id: string }> {
    if (typeof window !== 'undefined') {
      const formData = new FormData();
      formData.append('visit_id', visitId);
      formData.append('file', file);
      if (caption) formData.append('caption', caption);

      const res = await fetch('/api/visits/photos', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload photograph');
      }
      return { url: data.photo.url, id: data.photo.id };
    }
    throw new Error('Client context required');
  }

  static async deleteVisitPhoto(visitId: string, photoUrl: string): Promise<boolean> {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams({ visit_id: visitId, url: photoUrl });
      const res = await fetch(`/api/visits/photos?${params.toString()}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete photograph');
      }
      return true;
    }
    return false;
  }
}
