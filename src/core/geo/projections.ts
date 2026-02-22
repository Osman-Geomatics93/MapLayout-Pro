/**
 * Projection utilities — UTM zone detection, CRS metadata generation.
 */

import type { CRSInfo, LngLat } from '../types/geo';

/**
 * Detect the best-fit UTM zone for a given coordinate.
 * Works for all coordinates between 80°S and 84°N.
 */
export function detectUTMZone(center: LngLat): CRSInfo {
  const { lng, lat } = center;

  // Standard UTM zone calculation
  let zoneNumber = Math.floor((lng + 180) / 6) + 1;

  // Handle special zones for Svalbard and Norway
  if (lat >= 56 && lat < 64 && lng >= 3 && lng < 12) {
    zoneNumber = 32; // Norway
  } else if (lat >= 72 && lat < 84) {
    if (lng >= 0 && lng < 9) zoneNumber = 31;
    else if (lng >= 9 && lng < 21) zoneNumber = 33;
    else if (lng >= 21 && lng < 33) zoneNumber = 35;
    else if (lng >= 33 && lng < 42) zoneNumber = 37;
  }

  const hemisphere: 'N' | 'S' = lat >= 0 ? 'N' : 'S';
  const epsg = hemisphere === 'N' ? 32600 + zoneNumber : 32700 + zoneNumber;
  const centralMeridian = (zoneNumber - 1) * 6 - 180 + 3;

  return {
    name: `WGS 1984 UTM Zone ${zoneNumber}${hemisphere}`,
    epsg,
    projection: 'Transverse Mercator',
    datum: 'WGS 1984',
    units: 'Meter',
    centralMeridian,
    falseEasting: 500000,
    falseNorthing: hemisphere === 'S' ? 10000000 : 0,
    scaleFactor: 0.9996,
    hemisphere,
    zoneNumber,
  };
}

/**
 * Format the CRS metadata block lines for the layout.
 * Uses the "safe wording" approach: report display CRS separately from suggested analysis CRS.
 */
export function formatCRSBlock(crs: CRSInfo): string[] {
  return [
    `Display CRS: Web Mercator (EPSG:3857)`,
    `Recommended Analysis CRS: ${crs.name} (EPSG:${crs.epsg})`,
    `Projection: ${crs.projection} | Datum: ${crs.datum}`,
    `Central Meridian: ${crs.centralMeridian}° | Scale Factor: ${crs.scaleFactor}`,
    `Scale bar adjusted for center latitude`,
  ];
}

/**
 * Get the UTM zone letter designator for a latitude.
 */
export function getUTMLetterDesignator(lat: number): string {
  const letters = 'CDEFGHJKLMNPQRSTUVWX';
  if (lat < -80 || lat > 84) return 'Z'; // outside UTM limits
  const index = Math.floor((lat + 80) / 8);
  return letters[Math.min(index, letters.length - 1)];
}
