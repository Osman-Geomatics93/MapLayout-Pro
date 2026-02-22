/**
 * Scale bar computation — accurate ground distance at map center latitude.
 *
 * In Web Mercator, the scale varies with latitude. We compute the true
 * ground resolution at the center of the map and derive the scale bar from that.
 */

import type { ScaleBarInfo, LngLat } from '../types/geo';

/** Earth radius in meters (WGS84 semi-major axis) */
const EARTH_RADIUS = 6378137;

/** "Nice" distances for scale bar (in meters) */
const NICE_DISTANCES = [
  50, 100, 200, 500,
  1000, 2000, 5000, 10000,
  20000, 50000, 100000,
  200000, 500000, 1000000,
  2000000, 5000000,
];

/**
 * Compute ground resolution in meters per pixel at a given latitude and zoom.
 *
 * Formula: resolution = (C × cos(lat)) / 2^(zoom+8)
 * where C = 2π × R (Earth circumference)
 */
export function groundResolution(lat: number, zoom: number): number {
  const circumference = 2 * Math.PI * EARTH_RADIUS;
  return (circumference * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom + 8);
}

/**
 * Compute scale bar parameters for a map frame.
 *
 * @param center - Map center in WGS84
 * @param zoom - Map zoom level
 * @param mapWidthPx - Map frame width in screen pixels
 * @param mapWidthMM - Map frame width on the page in mm
 * @returns Scale bar configuration
 */
export function computeScaleBar(
  center: LngLat,
  zoom: number,
  mapWidthPx: number,
  mapWidthMM: number
): ScaleBarInfo {
  // Ground resolution at center latitude (meters per pixel)
  const metersPerPx = groundResolution(center.lat, zoom);

  // Total ground distance represented by the map frame
  const mapWidthMeters = mapWidthPx * metersPerPx;

  // Choose a nice scale bar distance (≤ 30% of map width)
  const targetMeters = mapWidthMeters * 0.3;
  let distanceMeters = NICE_DISTANCES[0];
  for (const d of NICE_DISTANCES) {
    if (d <= targetMeters) {
      distanceMeters = d;
    } else {
      break;
    }
  }

  // Scale bar width in mm on the page
  const widthMM = (distanceMeters / mapWidthMeters) * mapWidthMM;

  // Representative fraction: map distance on page / ground distance
  const mapWidthMetersOnPage = mapWidthMM / 1000;
  const representativeFraction = Math.round(mapWidthMeters / mapWidthMetersOnPage);

  // Human-readable label
  const label = formatDistance(distanceMeters);

  return {
    distanceMeters,
    widthMM,
    representativeFraction,
    label,
  };
}

/**
 * Format a distance in meters to a human-readable string.
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return km % 1 === 0 ? `${km} km` : `${km.toFixed(1)} km`;
  }
  return `${meters} m`;
}

/**
 * Compute the map scale string (e.g., "1:500,000").
 */
export function formatRepresentativeFraction(rf: number): string {
  return `1:${rf.toLocaleString()}`;
}
