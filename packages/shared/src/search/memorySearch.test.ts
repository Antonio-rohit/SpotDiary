import assert from 'node:assert';
import { test } from 'node:test';
import { parseNaturalLanguageMemoryQuery, filterVisits } from './memorySearch';
import type { Visit } from '../types';

test('parseNaturalLanguageMemoryQuery extracts category, item, and locality', () => {
  const query = 'Find the cafe where I had cold coffee with my girlfriend in Baner';
  const result = parseNaturalLanguageMemoryQuery(query);

  assert.strictEqual(result.extractedFilters.category, 'Cafes');
  assert.strictEqual(result.extractedFilters.locality, 'Baner');
  assert.strictEqual(result.extractedFilters.peopleContext, 'Partner');
  assert.strictEqual(result.extractedFilters.bestItem, 'cold coffee');
  assert.ok(result.confidence > 0.7);
});

test('filterVisits filters records by structured criteria', () => {
  const sampleVisits: Visit[] = [
    {
      id: 'v1',
      user_id: 'u1',
      place_id: 'p1',
      visited_at: '2026-08-01T00:00:00Z',
      rating: 5,
      best_item: 'Cold Coffee',
      people_context: 'Partner',
      visibility: 'private',
      created_at: '',
      updated_at: '',
      place: {
        id: 'p1',
        provider: 'demo',
        name: 'The Alleyway Cafe',
        category: 'Cafes',
        address: 'Baner',
        locality: 'Baner',
        city: 'Pune',
        verification_status: 'verified',
        created_at: '',
        updated_at: ''
      }
    },
    {
      id: 'v2',
      user_id: 'u1',
      place_id: 'p2',
      visited_at: '2026-08-02T00:00:00Z',
      rating: 3,
      best_item: 'Saffron Cheesecake',
      people_context: 'Friends',
      visibility: 'public',
      created_at: '',
      updated_at: '',
      place: {
        id: 'p2',
        provider: 'demo',
        name: 'Le Petit Bakery',
        category: 'Bakeries and Desserts',
        address: 'Kothrud',
        locality: 'Kothrud',
        city: 'Pune',
        verification_status: 'verified',
        created_at: '',
        updated_at: ''
      }
    }
  ];

  const matched = filterVisits(sampleVisits, {
    category: 'Cafes',
    peopleContext: 'Partner'
  });

  assert.strictEqual(matched.length, 1);
  assert.strictEqual(matched[0].id, 'v1');
});
