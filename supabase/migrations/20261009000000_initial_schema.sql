-- SpotDiary Initial Schema Migration
-- Database: PostgreSQL / Supabase

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PLACES TABLE
CREATE TABLE IF NOT EXISTS public.places (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('google', 'manual', 'demo')),
  provider_place_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  address TEXT NOT NULL,
  locality TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Pune',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  price_level INT CHECK (price_level BETWEEN 1 AND 4),
  verification_status TEXT NOT NULL DEFAULT 'user_submitted' CHECK (verification_status IN ('verified', 'user_submitted')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_provider_place UNIQUE (provider, provider_place_id)
);

-- 3. VISITS TABLE
CREATE TABLE IF NOT EXISTS public.visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  best_item TEXT NOT NULL,
  notes TEXT,
  people_context TEXT NOT NULL DEFAULT 'Solo' CHECK (people_context IN ('Solo', 'Friends', 'Partner', 'Family', 'Colleagues', 'Other')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. VISIT PHOTOS TABLE
CREATE TABLE IF NOT EXISTS public.visit_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. SAVED PLACES (WISHLIST) TABLE
CREATE TABLE IF NOT EXISTS public.saved_places (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_saved_place UNIQUE (user_id, place_id)
);

-- 6. COLLECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. COLLECTION PLACES TABLE
CREATE TABLE IF NOT EXISTS public.collection_places (
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, place_id)
);

-- 8. REVIEWS TABLE (PUBLIC)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TAGS TABLE
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

-- 10. VISIT TAGS TABLE
CREATE TABLE IF NOT EXISTS public.visit_tags (
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (visit_id, tag_id)
);

-- INDEXES FOR FAST DISCOVERY & MEMORY SEARCH
CREATE INDEX IF NOT EXISTS idx_places_locality ON public.places(locality);
CREATE INDEX IF NOT EXISTS idx_places_category ON public.places(category);
CREATE INDEX IF NOT EXISTS idx_visits_user_id ON public.visits(user_id);
CREATE INDEX IF NOT EXISTS idx_visits_place_id ON public.visits(place_id);
CREATE INDEX IF NOT EXISTS idx_visits_best_item ON public.visits(best_item);
CREATE INDEX IF NOT EXISTS idx_saved_places_user ON public.saved_places(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_user ON public.collections(user_id);

-- TRIGGER FOR UPDATED_AT
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_places_updated_at BEFORE UPDATE ON public.places FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- AUTOMATIC PROFILE CREATION TRIGGER ON AUTH SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || SUBSTRING(NEW.id::text FROM 1 FOR 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'SpotDiary User'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_tags ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Public profiles are readable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- PLACES POLICIES
CREATE POLICY "Places are readable by everyone" ON public.places FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create places" ON public.places FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update places they created" ON public.places FOR UPDATE USING (auth.uid() = created_by);

-- VISITS POLICIES (CRITICAL PRIVACY REQUIREMENT)
CREATE POLICY "Users can view their own visits" ON public.visits FOR SELECT USING (auth.uid() = user_id OR visibility = 'public');
CREATE POLICY "Users can create their own visits" ON public.visits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own visits" ON public.visits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own visits" ON public.visits FOR DELETE USING (auth.uid() = user_id);

-- VISIT PHOTOS POLICIES
CREATE POLICY "Visit photos viewable if visit is accessible" ON public.visit_photos FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.visits WHERE id = visit_id AND visibility = 'public'));
CREATE POLICY "Users can insert photos for their own visits" ON public.visit_photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete photos for their own visits" ON public.visit_photos FOR DELETE USING (auth.uid() = user_id);

-- SAVED PLACES POLICIES
CREATE POLICY "Users can view their own saved places" ON public.saved_places FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save places" ON public.saved_places FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove saved places" ON public.saved_places FOR DELETE USING (auth.uid() = user_id);

-- COLLECTIONS POLICIES
CREATE POLICY "View public collections or own collections" ON public.collections FOR SELECT USING (visibility = 'public' OR auth.uid() = user_id);
CREATE POLICY "Users can create collections" ON public.collections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own collections" ON public.collections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own collections" ON public.collections FOR DELETE USING (auth.uid() = user_id);

-- COLLECTION PLACES POLICIES
CREATE POLICY "View collection places if collection accessible" ON public.collection_places FOR SELECT USING (EXISTS (SELECT 1 FROM public.collections WHERE id = collection_id AND (visibility = 'public' OR user_id = auth.uid())));
CREATE POLICY "Manage collection places for own collections" ON public.collection_places FOR ALL USING (EXISTS (SELECT 1 FROM public.collections WHERE id = collection_id AND user_id = auth.uid()));

-- REVIEWS POLICIES
CREATE POLICY "Public reviews are viewable by everyone" ON public.reviews FOR SELECT USING (visibility = 'public' OR auth.uid() = user_id);
CREATE POLICY "Users can post reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can edit their own reviews" ON public.reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reviews" ON public.reviews FOR DELETE USING (auth.uid() = user_id);

-- TAGS POLICIES
CREATE POLICY "Tags readable by everyone" ON public.tags FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tags" ON public.tags FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- VISIT TAGS POLICIES
CREATE POLICY "Visit tags readable if visit accessible" ON public.visit_tags FOR SELECT USING (EXISTS (SELECT 1 FROM public.visits WHERE id = visit_id AND (visibility = 'public' OR user_id = auth.uid())));
CREATE POLICY "Users can attach tags to their own visits" ON public.visit_tags FOR ALL USING (EXISTS (SELECT 1 FROM public.visits WHERE id = visit_id AND user_id = auth.uid()));
