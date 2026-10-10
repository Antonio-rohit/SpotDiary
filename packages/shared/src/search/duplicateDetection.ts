import { Place } from '../types';

/**
 * Calculates Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Returns string similarity score between 0.0 and 1.0
 */
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase();
  const s2 = str2.trim().toLowerCase();
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  return (maxLength - distance) / maxLength;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  confidenceScore: number;
  matchedPlace?: Place;
  reason?: string;
}

/**
 * Checks if a proposed new place matches an existing place record in the database
 */
export function checkForDuplicatePlace(
  proposedName: string,
  proposedLocality: string,
  existingPlaces: Place[]
): DuplicateCheckResult {
  let highestScore = 0;
  let bestMatch: Place | undefined = undefined;

  const targetName = proposedName.trim().toLowerCase();
  const targetLocality = proposedLocality.trim().toLowerCase();

  for (const place of existingPlaces) {
    const placeName = place.name.trim().toLowerCase();
    const placeLocality = place.locality.trim().toLowerCase();

    // Locality match weight
    const localityMatches = placeLocality === targetLocality || 
      placeLocality.includes(targetLocality) || 
      targetLocality.includes(placeLocality);

    const nameScore = stringSimilarity(targetName, placeName);

    // Exact name match in same locality
    if (targetName === placeName && localityMatches) {
      return {
        isDuplicate: true,
        confidenceScore: 1.0,
        matchedPlace: place,
        reason: 'Exact match found in the same locality.'
      };
    }

    // High similarity (> 0.75) in same locality
    const combinedScore = localityMatches ? nameScore * 0.9 + 0.1 : nameScore * 0.5;

    if (combinedScore > highestScore) {
      highestScore = combinedScore;
      bestMatch = place;
    }
  }

  if (highestScore >= 0.75 && bestMatch) {
    return {
      isDuplicate: true,
      confidenceScore: highestScore,
      matchedPlace: bestMatch,
      reason: `Very similar place "${bestMatch.name}" already exists in ${bestMatch.locality}.`
    };
  }

  return {
    isDuplicate: false,
    confidenceScore: highestScore,
    matchedPlace: bestMatch
  };
}
