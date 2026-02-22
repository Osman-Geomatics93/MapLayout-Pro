/**
 * Graticule (coordinate grid) generator.
 *
 * Computes parallels and meridians within a bounding box
 * at appropriate intervals based on map scale.
 */

import type { BBox, GraticuleLines, GraticuleLine } from '../types/geo';

/** Possible graticule intervals in degrees */
const INTERVALS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 20, 30];

/**
 * Auto-select a graticule interval based on the extent size.
 * Target: roughly 4–8 grid lines across the map.
 */
export function autoGraticuleInterval(bbox: BBox): number {
  const latSpan = bbox.north - bbox.south;
  const lngSpan = bbox.east - bbox.west;
  const maxSpan = Math.max(latSpan, lngSpan);

  // Target 4–8 divisions
  const targetInterval = maxSpan / 6;

  // Find the nearest "nice" interval
  for (const interval of INTERVALS) {
    if (interval >= targetInterval * 0.7) {
      return interval;
    }
  }
  return INTERVALS[INTERVALS.length - 1];
}

/**
 * Generate graticule lines for a bounding box.
 *
 * @param bbox - Map extent in WGS84 degrees
 * @param intervalDeg - Grid interval in degrees, or 'auto'
 * @returns Arrays of parallels and meridians with labels
 */
export function generateGraticule(
  bbox: BBox,
  intervalDeg: number | 'auto' = 'auto'
): GraticuleLines {
  const interval = intervalDeg === 'auto' ? autoGraticuleInterval(bbox) : intervalDeg;

  const parallels: GraticuleLine[] = [];
  const meridians: GraticuleLine[] = [];

  // Small buffer to ensure lines extend to edges
  const buffer = interval * 0.01;

  // Generate parallels (horizontal lines of constant latitude)
  const startLat = Math.ceil(bbox.south / interval) * interval;
  for (let lat = startLat; lat <= bbox.north; lat += interval) {
    // Round to avoid floating point artifacts
    const roundedLat = Math.round(lat * 1e8) / 1e8;

    parallels.push({
      type: 'parallel',
      value: roundedLat,
      coords: [
        [bbox.west - buffer, roundedLat],
        [bbox.east + buffer, roundedLat],
      ],
      label: formatDMS(roundedLat, 'lat'),
    });
  }

  // Generate meridians (vertical lines of constant longitude)
  const startLng = Math.ceil(bbox.west / interval) * interval;
  for (let lng = startLng; lng <= bbox.east; lng += interval) {
    const roundedLng = Math.round(lng * 1e8) / 1e8;

    meridians.push({
      type: 'meridian',
      value: roundedLng,
      coords: [
        [roundedLng, bbox.south - buffer],
        [roundedLng, bbox.north + buffer],
      ],
      label: formatDMS(roundedLng, 'lng'),
    });
  }

  return { parallels, meridians };
}

/**
 * Format decimal degrees to Degrees-Minutes-Seconds string.
 *
 * @example formatDMS(14.5, 'lat') → "14°30'00\"N"
 * @example formatDMS(-33.25, 'lng') → "33°15'00\"W"
 */
export function formatDMS(decimal: number, axis: 'lat' | 'lng'): string {
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60);

  let suffix: string;
  if (axis === 'lat') {
    suffix = decimal >= 0 ? 'N' : 'S';
  } else {
    suffix = decimal >= 0 ? 'E' : 'W';
  }

  // For clean intervals, simplify the display
  if (sec === 0 && min === 0) {
    return `${deg}°${suffix}`;
  }
  if (sec === 0) {
    return `${deg}°${min.toString().padStart(2, '0')}'${suffix}`;
  }
  return `${deg}°${min.toString().padStart(2, '0')}'${sec.toString().padStart(2, '0')}"${suffix}`;
}

/**
 * Format decimal degrees as a simple number (e.g., "14.5°N").
 */
export function formatDD(decimal: number, axis: 'lat' | 'lng'): string {
  const suffix = axis === 'lat'
    ? (decimal >= 0 ? 'N' : 'S')
    : (decimal >= 0 ? 'E' : 'W');
  return `${Math.abs(decimal).toFixed(2)}°${suffix}`;
}
