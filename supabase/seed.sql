-- SpotDiary Seed Data for Pune, Maharashtra, India

-- Seed Tags
INSERT INTO public.tags (id, name, slug) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Coffee', 'coffee'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Date Night', 'date-night'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Cozy', 'cozy'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'Work Friendly', 'work-friendly'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'Outdoor Seating', 'outdoor-seating'),
  ('a1b2c3d4-0006-4000-8000-000000000006', 'Desserts', 'desserts')
ON CONFLICT (slug) DO NOTHING;

-- Seed Places in Pune
INSERT INTO public.places (id, provider, provider_place_id, name, description, category, address, locality, city, latitude, longitude, price_level, verification_status) VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    'demo',
    'pune_alleyway_baner',
    'The Alleyway Café & Bistro',
    'Rustic brick aesthetic with warm lighting, artisan pour-over coffees, and delicious cheesecakes. Perfect for dates and long conversations.',
    'Cafes',
    'Lane 5, High Street Road, Baner',
    'Baner',
    'Pune',
    18.5590,
    73.7868,
    2,
    'verified'
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'demo',
    'pune_botanica_kp',
    'Botanica Garden Cafe',
    'Lush green courtyard cafe nestled in Koregaon Park with vibrant outdoor seating, wood-fired pizzas, and specialty brew coffee.',
    'Date Night',
    'North Main Road, Koregaon Park',
    'Koregaon Park',
    'Pune',
    18.5362,
    73.8940,
    3,
    'verified'
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'demo',
    'pune_roast_viman',
    'The Roast Roastery & Co-Work',
    'Spacious work-friendly cafe with ultra-fast Wi-Fi, ergonomic seating, desk power ports, and micro-lot single origin beans.',
    'Work-Friendly Cafes',
    'Datta Mandir Chowk, Viman Nagar',
    'Viman Nagar',
    'Pune',
    18.5679,
    73.9143,
    2,
    'verified'
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'demo',
    'pune_le_petit_kothrud',
    'Le Petit Artisan Bakery & Dessert Bar',
    'French bakery known for melt-in-mouth croissants, pain au chocolat, custom cakes, and elegant afternoon tea experience.',
    'Bakeries and Desserts',
    'Ideal Colony, Kothrud',
    'Kothrud',
    'Pune',
    18.5074,
    73.8077,
    2,
    'verified'
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    'demo',
    'pune_rooftop_balewadi',
    'Highline Rooftop Lounge & Kitchen',
    'Panoramic skyline views of Balewadi High Street, live DJ sets, signature cocktails, and gourmet tapas.',
    'Clubs and Nightlife',
    'Balewadi High Street, Balewadi',
    'Balewadi',
    'Pune',
    18.5721,
    73.7745,
    3,
    'verified'
  ),
  (
    '00000000-0000-4000-8000-000000000006',
    'demo',
    'pune_fc_heritage',
    'FC Heritage Coffee House',
    'Iconic spot on Fergusson College Road serving rich filter coffee, bun maska, and modern espresso drinks in a nostalgic setting.',
    'Coffee Shops',
    'Opposite FC Main Gate, FC Road',
    'FC Road',
    'Pune',
    18.5228,
    73.8415,
    1,
    'verified'
  )
ON CONFLICT (provider, provider_place_id) DO NOTHING;
