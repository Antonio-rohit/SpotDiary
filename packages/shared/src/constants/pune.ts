import type { Category, PeopleContext, Place } from '../types';

export const PUNE_LOCALITIES = [
  'Baner',
  'Balewadi',
  'Koregaon Park',
  'Viman Nagar',
  'Kothrud',
  'Hinjawadi',
  'FC Road',
  'Shivajinagar',
  'Aundh',
  'Kalyani Nagar',
  'Bavdhan',
  'Erandwane',
  'Wakad',
  'Magarpatta'
] as const;

export const CATEGORIES: Category[] = [
  'Cafes',
  'Restaurants',
  'Coffee Shops',
  'Bakeries and Desserts',
  'Clubs and Nightlife',
  'Date Night',
  'Nature and Outdoor Places',
  'Work-Friendly Cafes'
];

export const PEOPLE_CONTEXT_OPTIONS: PeopleContext[] = [
  'Solo',
  'Friends',
  'Partner',
  'Family',
  'Colleagues',
  'Other'
];

// High quality unsplash photographs for realistic Pune cafes & places
export const DEMO_PUNE_PLACES: Place[] = [
  {
    id: 'pune-place-1',
    provider: 'demo',
    provider_place_id: 'pune_alleyway_baner',
    name: 'The Alleyway Café & Bistro',
    description: 'Rustic brick aesthetic with warm lighting, artisan pour-over coffees, and delicious cheesecakes. Perfect for dates and long conversations.',
    category: 'Cafes',
    address: 'Lane 5, High Street Road, Baner',
    locality: 'Baner',
    city: 'Pune',
    latitude: 18.5590,
    longitude: 73.7868,
    price_level: 2,
    verification_status: 'verified',
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    rating_avg: 4.9,
    reviews_count: 809,
    distance_km: 1.2,
    image_urls: [
      'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000',
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=1000',
      'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&q=80&w=1000'
    ],
    popular_items: ['Cold Coffee', 'Saffron Cheesecake', 'Truffle Fries', 'Iced Latte']
  },
  {
    id: 'pune-place-2',
    provider: 'demo',
    provider_place_id: 'pune_botanica_kp',
    name: 'Botanica Garden Cafe',
    description: 'Lush green courtyard cafe nestled in Koregaon Park with vibrant outdoor seating, wood-fired pizzas, and specialty brew coffee.',
    category: 'Date Night',
    address: 'North Main Road, Koregaon Park',
    locality: 'Koregaon Park',
    city: 'Pune',
    latitude: 18.5362,
    longitude: 73.8940,
    price_level: 3,
    verification_status: 'verified',
    created_at: '2026-01-18T10:00:00Z',
    updated_at: '2026-01-18T10:00:00Z',
    rating_avg: 4.8,
    reviews_count: 754,
    distance_km: 3.5,
    image_urls: [
      'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&q=80&w=1000',
      'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&q=80&w=1000'
    ],
    popular_items: ['Affogato', 'Neapolitan Pizza', 'Matcha Latte', 'Tiramisu']
  },
  {
    id: 'pune-place-3',
    provider: 'demo',
    provider_place_id: 'pune_roast_viman',
    name: 'The Roast Roastery & Co-Work',
    description: 'Spacious work-friendly cafe with ultra-fast Wi-Fi, ergonomic seating, ergonomic desk power ports, and micro-lot single origin beans.',
    category: 'Work-Friendly Cafes',
    address: 'Datta Mandir Chowk, Viman Nagar',
    locality: 'Viman Nagar',
    city: 'Pune',
    latitude: 18.5679,
    longitude: 73.9143,
    price_level: 2,
    verification_status: 'verified',
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-01T10:00:00Z',
    rating_avg: 4.7,
    reviews_count: 512,
    distance_km: 4.1,
    image_urls: [
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1000',
      'https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&q=80&w=1000'
    ],
    popular_items: ['Vietnamese Iced Coffee', 'Avocado Toast', 'Cold Brew', 'Almond Croissant']
  },
  {
    id: 'pune-place-4',
    provider: 'demo',
    provider_place_id: 'pune_le_petit_kothrud',
    name: 'Le Petit Artisan Bakery & Dessert Bar',
    description: 'French bakery known for melt-in-mouth croissants, pain au chocolat, custom cakes, and elegant afternoon tea experience.',
    category: 'Bakeries and Desserts',
    address: 'Ideal Colony, Kothrud',
    locality: 'Kothrud',
    city: 'Pune',
    latitude: 18.5074,
    longitude: 73.8077,
    price_level: 2,
    verification_status: 'verified',
    created_at: '2026-02-10T10:00:00Z',
    updated_at: '2026-02-10T10:00:00Z',
    rating_avg: 4.9,
    reviews_count: 620,
    distance_km: 2.8,
    image_urls: [
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=1000',
      'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=1000'
    ],
    popular_items: ['Pain Au Chocolat', 'Berry Tart', 'Eclair', 'Hot Chocolate']
  },
  {
    id: 'pune-place-5',
    provider: 'demo',
    provider_place_id: 'pune_rooftop_balewadi',
    name: 'Highline Rooftop Lounge & Kitchen',
    description: 'Panoramic skyline views of Balewadi High Street, live DJ sets, signature cocktails, and gourmet tapas.',
    category: 'Clubs and Nightlife',
    address: 'Balewadi High Street, Balewadi',
    locality: 'Balewadi',
    city: 'Pune',
    latitude: 18.5721,
    longitude: 73.7745,
    price_level: 3,
    verification_status: 'verified',
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-02-15T10:00:00Z',
    rating_avg: 4.6,
    reviews_count: 940,
    distance_km: 2.0,
    image_urls: [
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1000',
      'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&q=80&w=1000'
    ],
    popular_items: ['Smoked Rosemary Gin', 'Woodfired Dim Sum', 'Craft Beer Flight']
  },
  {
    id: 'pune-place-6',
    provider: 'demo',
    provider_place_id: 'pune_fc_heritage',
    name: 'FC Heritage Coffee House',
    description: 'Iconic spot on Fergusson College Road serving rich filter coffee, bun maska, and modern espresso drinks in a nostalgic setting.',
    category: 'Coffee Shops',
    address: 'Opposite FC Main Gate, FC Road',
    locality: 'FC Road',
    city: 'Pune',
    latitude: 18.5228,
    longitude: 73.8415,
    price_level: 1,
    verification_status: 'verified',
    created_at: '2026-02-20T10:00:00Z',
    updated_at: '2026-02-20T10:00:00Z',
    rating_avg: 4.8,
    reviews_count: 1208,
    distance_km: 4.5,
    image_urls: [
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=1000',
      'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&q=80&w=1000'
    ],
    popular_items: ['Filter Coffee', 'Bun Maska', 'Irani Chai', 'Cold Coffee with Cream']
  }
];
