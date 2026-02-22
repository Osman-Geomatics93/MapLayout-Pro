/** User-imported data layer types */

export interface UserDataLayer {
  id: string;
  name: string;
  geojson: GeoJSON.FeatureCollection;
  geometryType: 'Point' | 'LineString' | 'Polygon' | 'Mixed';
  color: string;
  opacity: number;
  visible: boolean;
  legendLabel: string;
}
