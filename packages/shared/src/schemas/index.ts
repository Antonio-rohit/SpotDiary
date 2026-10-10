import { z } from 'zod';

export const CategoryEnum = z.enum([
  'Cafes',
  'Restaurants',
  'Coffee Shops',
  'Bakeries and Desserts',
  'Clubs and Nightlife',
  'Date Night',
  'Nature and Outdoor Places',
  'Work-Friendly Cafes'
]);

export const PeopleContextEnum = z.enum([
  'Solo',
  'Friends',
  'Partner',
  'Family',
  'Colleagues',
  'Other'
]);

export const VisibilityEnum = z.enum(['public', 'private']);

export const RegisterSchema = z
  .object({
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .email('Please enter a valid email address'),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters long'),
    displayName: z
      .string()
      .trim()
      .refine((val) => val === '' || val.length >= 2, {
        message: 'Display name must be at least 2 characters',
      })
      .optional(),
    name: z
      .string()
      .trim()
      .refine((val) => val === '' || val.length >= 2, {
        message: 'Name must be at least 2 characters',
      })
      .optional(),
    display_name: z
      .string()
      .trim()
      .refine((val) => val === '' || val.length >= 2, {
        message: 'Display name must be at least 2 characters',
      })
      .optional(),
  })
  .transform((data) => {
    const rawName = data.displayName || data.name || data.display_name;
    const trimmedName = rawName ? rawName.trim() : undefined;
    return {
      email: data.email.toLowerCase().trim(),
      password: data.password,
      displayName: trimmedName && trimmedName.length >= 2 ? trimmedName : undefined,
    };
  });

export const LoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address')
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Password reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters long')
});

export const VisitSchema = z.object({
  place_id: z.string().min(1, 'Place is required'),
  visited_at: z.string().min(1, 'Visit date is required'),
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  best_item: z.string().min(1, 'Please enter your favorite food, drink or experience'),
  notes: z.string().optional(),
  people_context: PeopleContextEnum,
  tags: z.array(z.string()).default([]),
  photos: z.array(z.string()).default([]),
  visibility: VisibilityEnum.default('private')
});

export const VisitEditSchema = z.object({
  id: z.string().min(1, 'Visit ID is required'),
  visited_at: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
  best_item: z.string().min(1).optional(),
  notes: z.string().optional(),
  people_context: PeopleContextEnum.optional(),
  tags: z.array(z.string()).optional(),
  visibility: VisibilityEnum.optional()
});

export const ManualPlaceSchema = z.object({
  name: z.string().min(2, 'Place name must be at least 2 characters'),
  category: CategoryEnum,
  address: z.string().min(5, 'Address must be at least 5 characters'),
  locality: z.string().min(2, 'Locality is required (e.g. Baner, Koregaon Park)'),
  city: z.string().default('Pune'),
  description: z.string().optional(),
  price_level: z.number().min(1).max(4).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional()
});

export const CollectionSchema = z.object({
  title: z.string().min(1, 'Collection title is required').max(100, 'Title must be 100 characters or fewer'),
  description: z.string().optional(),
  visibility: VisibilityEnum.default('public'),
  place_ids: z.array(z.string()).default([])
});

export const CollectionEditSchema = z.object({
  title: z.string().min(1, 'Collection title is required').max(100).optional(),
  description: z.string().optional(),
  visibility: VisibilityEnum.optional(),
  place_ids: z.array(z.string()).optional()
});

export const ProfileEditSchema = z.object({
  display_name: z.string().min(2, 'Display name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  bio: z.string().max(250, 'Bio must be 250 characters or less').optional(),
  avatar_url: z.string().optional()
});

export const PhotoUploadMetadataSchema = z.object({
  visit_id: z.string().min(1, 'Visit ID is required'),
  caption: z.string().max(200).optional()
});

export const MemorySearchSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  locality: z.string().optional(),
  peopleContext: z.string().optional(),
  bestItem: z.string().optional(),
  tag: z.string().optional(),
  minRating: z.number().min(1).max(5).optional(),
  isNaturalLanguage: z.boolean().default(false)
});
