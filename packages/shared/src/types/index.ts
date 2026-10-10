export type Category = 
  | 'Cafes'
  | 'Restaurants'
  | 'Coffee Shops'
  | 'Bakeries and Desserts'
  | 'Clubs and Nightlife'
  | 'Date Night'
  | 'Nature and Outdoor Places'
  | 'Work-Friendly Cafes';

export type PeopleContext = 
  | 'Solo'
  | 'Friends'
  | 'Partner'
  | 'Family'
  | 'Colleagues'
  | 'Other';

export type Visibility = 'public' | 'private';

export type VerificationStatus = 'verified' | 'user_submitted';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
  updated_at: string;
}

export interface Place {
  id: string;
  provider: 'google' | 'manual' | 'demo';
  provider_place_id?: string;
  name: string;
  description?: string;
  category: Category;
  address: string;
  locality: string; // Pune locality e.g. Baner, Koregaon Park, FC Road
  city: string; // Pune
  latitude?: number;
  longitude?: number;
  price_level?: number; // 1-4 ($ to $$$$)
  verification_status: VerificationStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Computed or aggregated fields
  rating_avg?: number;
  reviews_count?: number;
  distance_km?: number;
  image_urls?: string[];
  popular_items?: string[];
}

export interface VisitPhoto {
  id: string;
  visit_id: string;
  user_id: string;
  storage_path: string;
  url?: string;
  caption?: string;
  created_at: string;
}

export interface Visit {
  id: string;
  user_id: string;
  place_id: string;
  visited_at: string;
  rating: number; // 1-5
  best_item: string;
  notes?: string;
  people_context: PeopleContext;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
  // Joined relation fields
  place?: Place;
  photos?: VisitPhoto[];
  tags?: string[];
  user_profile?: Profile;
}

export interface SavedPlace {
  id: string;
  user_id: string;
  place_id: string;
  created_at: string;
  place?: Place;
}

export interface Collection {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
  user_profile?: Profile;
  places_count?: number;
  cover_image?: string;
  places?: Place[];
  place_ids?: string[];
}

export interface CollectionPlace {
  collection_id: string;
  place_id: string;
  position: number;
  added_at: string;
  place?: Place;
}

export interface Review {
  id: string;
  user_id: string;
  place_id: string;
  visit_id?: string;
  rating: number;
  review_text: string;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
  user_profile?: Profile;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface SearchFilters {
  query?: string;
  category?: Category | 'All';
  locality?: string;
  peopleContext?: PeopleContext | 'All';
  minRating?: number;
  dateRange?: {
    start?: string;
    end?: string;
  };
  bestItem?: string;
  tag?: string;
  visibility?: Visibility | 'All';
  priceLevel?: number;
  sortBy?: 'visited_at_desc' | 'rating_desc' | 'name_asc' | 'distance_asc';
}

export interface NaturalLanguageInterpretation {
  interpretedQuery: string;
  confidence: number;
  extractedFilters: {
    category?: Category;
    locality?: string;
    peopleContext?: PeopleContext;
    bestItem?: string;
    timeframeDescription?: string;
    minRating?: number;
    keywords?: string[];
  };
}
