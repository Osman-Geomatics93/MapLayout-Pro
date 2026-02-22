declare module 'shpjs' {
  function shp(input: string | ArrayBuffer): Promise<GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[]>;
  export default shp;
}

declare module '@mapbox/togeojson' {
  export function kml(doc: Document): GeoJSON.FeatureCollection;
  export function gpx(doc: Document): GeoJSON.FeatureCollection;
}
