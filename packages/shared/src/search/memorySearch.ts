import type { Category, NaturalLanguageInterpretation, PeopleContext, SearchFilters, Visit } from '../types';
import { CATEGORIES, PEOPLE_CONTEXT_OPTIONS, PUNE_LOCALITIES } from '../constants/pune';

/**
 * Natural language query parser for personal visit history.
 * Translates queries like "cafe where I had cold coffee with my girlfriend in Baner" into structured filters.
 */
export function parseNaturalLanguageMemoryQuery(query: string): NaturalLanguageInterpretation {
  const q = query.trim().toLowerCase();
  
  let detectedCategory: Category | undefined = undefined;
  let detectedLocality: string | undefined = undefined;
  let detectedPeopleContext: PeopleContext | undefined = undefined;
  let detectedBestItem: string | undefined = undefined;
  let detectedMinRating: number | undefined = undefined;
  const keywords: string[] = [];

  // 1. Detect Category
  if (q.includes('cafe') || q.includes('café') || q.includes('coffee shop')) {
    detectedCategory = 'Cafes';
  } else if (q.includes('restaurant') || q.includes('dinner') || q.includes('lunch') || q.includes('food')) {
    detectedCategory = 'Restaurants';
  } else if (q.includes('bakery') || q.includes('dessert') || q.includes('cake') || q.includes('pastry') || q.includes('cheesecake')) {
    detectedCategory = 'Bakeries and Desserts';
  } else if (q.includes('pub') || q.includes('club') || q.includes('bar') || q.includes('nightlife') || q.includes('drinks')) {
    detectedCategory = 'Clubs and Nightlife';
  } else if (q.includes('date') || q.includes('romantic')) {
    detectedCategory = 'Date Night';
  } else if (q.includes('work') || q.includes('laptop') || q.includes('study')) {
    detectedCategory = 'Work-Friendly Cafes';
  }

  // 2. Detect Pune Locality
  for (const loc of PUNE_LOCALITIES) {
    if (q.includes(loc.toLowerCase())) {
      detectedLocality = loc;
      break;
    }
  }

  // 3. Detect People Context
  if (q.includes('girlfriend') || q.includes('boyfriend') || q.includes('partner') || q.includes('wife') || q.includes('husband') || q.includes('date')) {
    detectedPeopleContext = 'Partner';
  } else if (q.includes('friend') || q.includes('friends') || q.includes('buddies') || q.includes('group')) {
    detectedPeopleContext = 'Friends';
  } else if (q.includes('family') || q.includes('parents') || q.includes('mom') || q.includes('dad') || q.includes('kids')) {
    detectedPeopleContext = 'Family';
  } else if (q.includes('colleague') || q.includes('coworker') || q.includes('workmates') || q.includes('office')) {
    detectedPeopleContext = 'Colleagues';
  } else if (q.includes('alone') || q.includes('solo') || q.includes('myself')) {
    detectedPeopleContext = 'Solo';
  }

  // 4. Detect Popular Food / Drink Items
  const foodKeywords = [
    'cold coffee', 'coffee', 'cheesecake', 'pizza', 'burger', 'croissant', 
    'latte', 'espresso', 'affogato', 'truffle fries', 'pasta', 'tiramisu',
    'hot chocolate', 'matcha', 'tea', 'chai', 'bun maska', 'beer', 'cocktail', 'dim sum'
  ];

  for (const item of foodKeywords) {
    if (q.includes(item)) {
      detectedBestItem = item;
      break;
    }
  }

  // 5. Detect Rating expressions
  if (q.includes('best') || q.includes('top rated') || q.includes('5 star') || q.includes('amazing') || q.includes('favorite')) {
    detectedMinRating = 4;
  }

  // Confidence estimation based on matched tokens
  let matchesCount = 0;
  if (detectedCategory) matchesCount++;
  if (detectedLocality) matchesCount++;
  if (detectedPeopleContext) matchesCount++;
  if (detectedBestItem) matchesCount++;
  if (detectedMinRating) matchesCount++;

  const confidence = Math.min(0.95, 0.4 + matchesCount * 0.15);

  return {
    interpretedQuery: query,
    confidence,
    extractedFilters: {
      category: detectedCategory,
      locality: detectedLocality,
      peopleContext: detectedPeopleContext,
      bestItem: detectedBestItem,
      minRating: detectedMinRating,
      keywords
    }
  };
}

/**
 * Filters a list of Visit records according to search filters (structured or parsed NL)
 */
export function filterVisits(visits: Visit[], filters: SearchFilters): Visit[] {
  return visits.filter(visit => {
    const place = visit.place;

    // 1. General search query (matches place name, best_item, notes, locality, tags)
    if (filters.query && filters.query.trim().length > 0) {
      const q = filters.query.trim().toLowerCase();
      const placeName = place?.name.toLowerCase() || '';
      const locality = place?.locality.toLowerCase() || '';
      const bestItem = visit.best_item.toLowerCase();
      const notes = (visit.notes || '').toLowerCase();
      const tags = (visit.tags || []).map(t => t.toLowerCase()).join(' ');

      const matchesSearch = placeName.includes(q) ||
        locality.includes(q) ||
        bestItem.includes(q) ||
        notes.includes(q) ||
        tags.includes(q);

      if (!matchesSearch) return false;
    }

    // 2. Category filter
    if (filters.category && filters.category !== 'All') {
      if (place?.category !== filters.category) return false;
    }

    // 3. Locality filter
    if (filters.locality && filters.locality !== 'All') {
      if (place?.locality.toLowerCase() !== filters.locality.toLowerCase()) return false;
    }

    // 4. People Context filter
    if (filters.peopleContext && filters.peopleContext !== 'All') {
      if (visit.people_context !== filters.peopleContext) return false;
    }

    // 5. Rating filter
    if (filters.minRating && filters.minRating > 0) {
      if (visit.rating < filters.minRating) return false;
    }

    // 6. Best Item specific match
    if (filters.bestItem) {
      if (!visit.best_item.toLowerCase().includes(filters.bestItem.toLowerCase())) return false;
    }

    // 7. Tag filter
    if (filters.tag) {
      const hasTag = (visit.tags || []).some(t => t.toLowerCase() === filters.tag?.toLowerCase());
      if (!hasTag) return false;
    }

    // 8. Visibility filter
    if (filters.visibility && filters.visibility !== 'All') {
      if (visit.visibility !== filters.visibility) return false;
    }

    return true;
  });
}
