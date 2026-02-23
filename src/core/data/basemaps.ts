/**
 * Basemap Catalog — All available basemaps for MapLayout Pro.
 *
 * Converted from QGIS basemaps collection (credit: Klas Karlsson).
 * Excludes: Bing VirtualEarth (quadkey), polar-projection NASAGIBS (epsg3031/3413).
 */

export interface BasemapDefinition {
  id: string;
  name: string;
  category: string;
  type: 'xyz' | 'wms';
  tiles: string[];
  tileSize: number;
  attribution: string;
  maxzoom: number;
  minzoom: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function xyz(
  id: string, name: string, category: string,
  url: string, attribution: string,
  maxzoom = 20, minzoom = 0,
): BasemapDefinition {
  return { id, name, category, type: 'xyz', tiles: [url], tileSize: 256, attribution, maxzoom, minzoom };
}

function wmsEntry(
  id: string, name: string, category: string,
  baseUrl: string, layers: string, attribution: string,
): BasemapDefinition {
  const base = baseUrl.replace(/\?$/, '');
  const url = `${base}?service=WMS&version=1.1.1&request=GetMap&layers=${encodeURIComponent(layers)}&styles=&format=image/png&srs=EPSG:3857&transparent=true&width=256&height=256&bbox={bbox-epsg-3857}`;
  return { id, name, category, type: 'wms', tiles: [url], tileSize: 256, attribution, maxzoom: 20, minzoom: 0 };
}

// ─── Catalog ──────────────────────────────────────────────────────────

export const BASEMAP_CATALOG: BasemapDefinition[] = [

  // ── OpenStreetMap ────────────────────────────────────────────────────
  {
    id: 'openstreetmap', name: 'Standard', category: 'OpenStreetMap',
    type: 'xyz',
    tiles: [
      'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ],
    tileSize: 256, attribution: '© OpenStreetMap contributors', maxzoom: 19, minzoom: 0,
  },
  xyz('osm-bzh', 'BZH (Breton)', 'OpenStreetMap', 'https://tile.openstreetmap.bzh/br/{z}/{x}/{y}.png', '© OpenStreetMap contributors', 19),
  xyz('osm-bw', 'Black & White', 'OpenStreetMap', 'https://tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png', '© OpenStreetMap contributors', 19),
  xyz('osm-ch', 'Switzerland', 'OpenStreetMap', 'https://tile.osm.ch/switzerland/{z}/{x}/{y}.png', '© OpenStreetMap contributors', 19),
  xyz('osm-de', 'Germany', 'OpenStreetMap', 'https://tile.openstreetmap.de/{z}/{x}/{y}.png', '© OpenStreetMap contributors', 19),
  xyz('osm-hot', 'Humanitarian (HOT)', 'OpenStreetMap', 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', '© OpenStreetMap contributors, HOT', 19),
  xyz('cyclosm', 'CyclOSM', 'OpenStreetMap', 'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', '© CyclOSM | OpenStreetMap contributors', 19),
  xyz('opentopomap', 'OpenTopoMap', 'OpenStreetMap', 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png', '© OpenStreetMap contributors, SRTM | OpenTopoMap (CC-BY-SA)', 17),

  // ── Google ───────────────────────────────────────────────────────────
  xyz('google-maps', 'Maps', 'Google', 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', '© Google'),
  xyz('google-satellite', 'Satellite', 'Google', 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', '© Google'),
  xyz('google-terrain', 'Terrain', 'Google', 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', '© Google'),
  xyz('google-hybrid', 'Hybrid', 'Google', 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', '© Google'),

  // ── Esri ─────────────────────────────────────────────────────────────
  xyz('esri-antarctic-basemap', 'Antarctic Basemap', 'Esri', 'https://tiles.arcgis.com/tiles/C8EMgrsFcRFL6LrL/arcgis/rest/services/Antarctic_Basemap/MapServer/tile/{z}/{y}/{x}', '© NOAA NCEI, Esri'),
  xyz('esri-antarctic-imagery', 'Antarctic Imagery', 'Esri', 'https://server.arcgisonline.com/ArcGIS/rest/services/Polar/Antarctic_Imagery/MapServer/tile/{z}/{y}/{x}', '© Earthstar Geographics, Esri'),
  xyz('esri-arctic-imagery', 'Arctic Imagery', 'Esri', 'https://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Imagery/MapServer/tile/{z}/{y}/{x}', '© Earthstar Geographics, Esri'),
  xyz('esri-arctic-ocean-base', 'Arctic Ocean Base', 'Esri', 'https://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Ocean_Base/MapServer/tile/{z}/{y}/{x}', '© Esri, DeLorme, NAVTEQ'),
  xyz('esri-arctic-ocean-ref', 'Arctic Ocean Reference', 'Esri', 'https://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Ocean_Reference/MapServer/tile/{z}/{y}/{x}', '© Esri, DeLorme, NAVTEQ'),
  xyz('esri-natgeo', 'Nat Geo World Map', 'Esri', 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', '© Esri, National Geographic'),
  xyz('esri-ocean', 'Ocean Basemap', 'Esri', 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', '© Esri, GEBCO, NOAA'),
  xyz('esri-gray-canvas', 'World Gray Canvas', 'Esri', 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', '© Esri, DeLorme, NAVTEQ'),
  xyz('esri-world-imagery', 'World Imagery', 'Esri', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', '© Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping'),
  xyz('esri-world-physical', 'World Physical', 'Esri', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}', '© Esri, US NPS'),
  xyz('esri-world-relief', 'World Shaded Relief', 'Esri', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', '© Esri'),
  xyz('esri-world-street', 'World Street Map', 'Esri', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', '© Esri, DeLorme, NAVTEQ, USGS'),
  xyz('esri-world-terrain', 'World Terrain', 'Esri', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}', '© Esri, USGS, TANA, DeLorme'),
  xyz('esri-world-topo', 'World Topo Map', 'Esri', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', '© Esri, DeLorme, NAVTEQ, TomTom'),

  // ── CartoDB (CARTO) ──────────────────────────────────────────────────
  xyz('carto-dark', 'Dark Matter', 'CartoDB', 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', '© OpenStreetMap contributors, © CARTO', 20),
  xyz('carto-dark-nolabel', 'Dark Matter (No Labels)', 'CartoDB', 'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png', '© OpenStreetMap contributors, © CARTO', 20),
  xyz('carto-dark-labels', 'Dark Matter (Labels Only)', 'CartoDB', 'https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png', '© OpenStreetMap contributors, © CARTO', 20),
  xyz('carto-positron', 'Positron', 'CartoDB', 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', '© OpenStreetMap contributors, © CARTO', 20),
  xyz('carto-positron-nolabel', 'Positron (No Labels)', 'CartoDB', 'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', '© OpenStreetMap contributors, © CARTO', 20),
  xyz('carto-positron-labels', 'Positron (Labels Only)', 'CartoDB', 'https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png', '© OpenStreetMap contributors, © CARTO', 20),
  xyz('carto-voyager', 'Voyager', 'CartoDB', 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', '© OpenStreetMap contributors, © CARTO', 20),
  xyz('carto-voyager-under', 'Voyager (Labels Under)', 'CartoDB', 'https://a.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}.png', '© OpenStreetMap contributors, © CARTO', 20),
  xyz('carto-voyager-nolabel', 'Voyager (No Labels)', 'CartoDB', 'https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png', '© OpenStreetMap contributors, © CARTO', 20),
  xyz('carto-voyager-labels', 'Voyager (Labels Only)', 'CartoDB', 'https://a.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png', '© OpenStreetMap contributors, © CARTO', 20),

  // ── NASA GIBS ────────────────────────────────────────────────────────
  xyz('nasa-aster-relief', 'ASTER GDEM Shaded Relief', 'NASA GIBS', 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/ASTER_GDEM_Greyscale_Shaded_Relief/default/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg', '© NASA GIBS', 12),
  xyz('nasa-bluemarble', 'Blue Marble', 'NASA GIBS', 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg', '© NASA GIBS', 8),
  xyz('nasa-modis-aqua-721', 'MODIS Aqua Bands 721', 'NASA GIBS', 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Aqua_CorrectedReflectance_Bands721/default//GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', '© NASA GIBS', 9),
  xyz('nasa-modis-aqua-true', 'MODIS Aqua True Color', 'NASA GIBS', 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Aqua_CorrectedReflectance_TrueColor/default//GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', '© NASA GIBS', 9),
  xyz('nasa-modis-terra-aod', 'MODIS Terra Aerosol', 'NASA GIBS', 'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/MODIS_Terra_Aerosol/default//GoogleMapsCompatible_Level6/{z}/{y}/{x}.png', '© NASA GIBS', 6),
  xyz('nasa-modis-terra-367', 'MODIS Terra Bands 367', 'NASA GIBS', 'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/MODIS_Terra_CorrectedReflectance_Bands367/default//GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', '© NASA GIBS', 9),
  xyz('nasa-modis-terra-721', 'MODIS Terra Bands 721', 'NASA GIBS', 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_Bands721/default//GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', '© NASA GIBS', 9),
  xyz('nasa-modis-chlorophyll', 'MODIS Terra Chlorophyll', 'NASA GIBS', 'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/MODIS_Terra_L2_Chlorophyll_A/default//GoogleMapsCompatible_Level7/{z}/{y}/{x}.png', '© NASA GIBS', 7),
  xyz('nasa-modis-lst-day', 'MODIS Terra LST (Day)', 'NASA GIBS', 'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/MODIS_Terra_Land_Surface_Temp_Day/default//GoogleMapsCompatible_Level7/{z}/{y}/{x}.png', '© NASA GIBS', 7),
  xyz('nasa-modis-snow', 'MODIS Terra Snow Cover', 'NASA GIBS', 'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/MODIS_Terra_NDSI_Snow_Cover/default//GoogleMapsCompatible_Level8/{z}/{y}/{x}.png', '© NASA GIBS', 8),
  xyz('nasa-modis-terra-true', 'MODIS Terra True Color', 'NASA GIBS', 'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/MODIS_Terra_CorrectedReflectance_TrueColor/default//GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', '© NASA GIBS', 9),
  xyz('nasa-viirs-night', 'VIIRS Earth at Night 2012', 'NASA GIBS', 'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default//GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg', '© NASA GIBS', 8),
  xyz('nasa-viirs-true', 'VIIRS True Color', 'NASA GIBS', 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default//GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', '© NASA GIBS', 9),

  // ── USGS (XYZ) ──────────────────────────────────────────────────────
  xyz('usgs-imagery', 'US Imagery', 'USGS', 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}', '© USGS', 20),
  xyz('usgs-imagery-topo', 'US Imagery + Topo', 'USGS', 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}', '© USGS', 20),
  xyz('usgs-topo', 'US Topo', 'USGS', 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', '© USGS', 20),

  // ── BaseMapDE ────────────────────────────────────────────────────────
  xyz('basemapde-color', 'Color', 'BaseMapDE', 'https://sgx.geodatenzentrum.de/wmts_basemapde/tile/1.0.0/de_basemapde_web_raster_farbe/default/GLOBAL_WEBMERCATOR/{z}/{y}/{x}.png', '© dl-de/by-2-0', 20),
  xyz('basemapde-grey', 'Grey', 'BaseMapDE', 'https://sgx.geodatenzentrum.de/wmts_basemapde/tile/1.0.0/de_basemapde_web_raster_grau/default/GLOBAL_WEBMERCATOR/{z}/{y}/{x}.png', '© dl-de/by-2-0', 20),

  // ── TopPlusOpen ──────────────────────────────────────────────────────
  xyz('topplusopen-color', 'Color', 'TopPlusOpen', 'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png', '© dl-de/by-2-0', 20),
  xyz('topplusopen-grey', 'Grey', 'TopPlusOpen', 'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web_grau/default/WEBMERCATOR/{z}/{y}/{x}.png', '© dl-de/by-2-0', 20),

  // ── Swiss Federal Geoportal (tiles only available over Switzerland, zoom 7+) ──
  xyz('swiss-journey', 'Journey Through Time', 'Swiss', 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.zeitreihen/default/18641231/3857/{z}/{x}/{y}.png', '© swisstopo', 18, 7),
  xyz('swiss-color', 'National Map Color', 'Swiss', 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg', '© swisstopo', 18, 7),
  xyz('swiss-grey', 'National Map Grey', 'Swiss', 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg', '© swisstopo', 18, 7),
  xyz('swiss-image', 'SWISSIMAGE', 'Swiss', 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg', '© swisstopo', 18, 7),

  // ── NL Maps ──────────────────────────────────────────────────────────
  xyz('nlmaps-grijs', 'Grey', 'NL Maps', 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png', '© Kadaster', 20),
  xyz('nlmaps-luchtfoto', 'Aerial Photo', 'NL Maps', 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_ortho25/EPSG:3857/{z}/{x}/{y}.jpeg', '© Kadaster', 20),
  xyz('nlmaps-pastel', 'Pastel', 'NL Maps', 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/pastel/EPSG:3857/{z}/{x}/{y}.png', '© Kadaster', 20),
  xyz('nlmaps-standaard', 'Standard', 'NL Maps', 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png', '© Kadaster', 20),
  xyz('nlmaps-water', 'Water', 'NL Maps', 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/water/EPSG:3857/{z}/{x}/{y}.png', '© Kadaster', 20),

  // ── OneMapSG ─────────────────────────────────────────────────────────
  xyz('onemapsg-default', 'Default', 'OneMapSG', 'https://maps-a.onemap.sg/v3/Default/{z}/{x}/{y}.png', '© OneMap Singapore', 19),
  xyz('onemapsg-grey', 'Grey', 'OneMapSG', 'https://maps-a.onemap.sg/v3/Grey/{z}/{x}/{y}.png', '© OneMap Singapore', 19),
  xyz('onemapsg-landlot', 'Land Lot', 'OneMapSG', 'https://maps-a.onemap.sg/v3/LandLot/{z}/{x}/{y}.png', '© OneMap Singapore', 19),
  xyz('onemapsg-night', 'Night', 'OneMapSG', 'https://maps-a.onemap.sg/v3/Night/{z}/{x}/{y}.png', '© OneMap Singapore', 19),
  xyz('onemapsg-original', 'Original', 'OneMapSG', 'https://maps-a.onemap.sg/v3/Original/{z}/{x}/{y}.png', '© OneMap Singapore', 19),

  // ── HikeBike ─────────────────────────────────────────────────────────
  xyz('hikebike', 'HikeBike', 'HikeBike', 'https://tiles.wmflabs.org/hikebike/{z}/{x}/{y}.png', '© OpenStreetMap contributors', 19),
  xyz('hikebike-hillshading', 'Hill Shading', 'HikeBike', 'https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png', '© OpenStreetMap contributors', 19),

  // ── Strava ───────────────────────────────────────────────────────────
  xyz('strava-all', 'All Activities', 'Strava', 'https://heatmap-external-a.strava.com/tiles/all/hot/{z}/{x}/{y}.png', '© Strava', 15),
  xyz('strava-ride', 'Ride', 'Strava', 'https://heatmap-external-a.strava.com/tiles/ride/hot/{z}/{x}/{y}.png', '© Strava', 15),
  xyz('strava-run', 'Run', 'Strava', 'https://heatmap-external-a.strava.com/tiles/run/bluered/{z}/{x}/{y}.png', '© Strava', 15),
  xyz('strava-water', 'Water', 'Strava', 'https://heatmap-external-a.strava.com/tiles/water/blue/{z}/{x}/{y}.png', '© Strava', 15),
  xyz('strava-winter', 'Winter', 'Strava', 'https://heatmap-external-a.strava.com/tiles/winter/hot/{z}/{x}/{y}.png', '© Strava', 15),

  // ── WaymarkedTrails ──────────────────────────────────────────────────
  xyz('waymarked-cycling', 'Cycling', 'WaymarkedTrails', 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png', '© OpenStreetMap contributors, Waymarked Trails', 18),
  xyz('waymarked-hiking', 'Hiking', 'WaymarkedTrails', 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', '© OpenStreetMap contributors, Waymarked Trails', 18),
  xyz('waymarked-mtb', 'MTB', 'WaymarkedTrails', 'https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png', '© OpenStreetMap contributors, Waymarked Trails', 18),
  xyz('waymarked-riding', 'Riding', 'WaymarkedTrails', 'https://tile.waymarkedtrails.org/riding/{z}/{x}/{y}.png', '© OpenStreetMap contributors, Waymarked Trails', 18),
  xyz('waymarked-skating', 'Skating', 'WaymarkedTrails', 'https://tile.waymarkedtrails.org/skating/{z}/{x}/{y}.png', '© OpenStreetMap contributors, Waymarked Trails', 18),
  xyz('waymarked-slopes', 'Slopes', 'WaymarkedTrails', 'https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png', '© OpenStreetMap contributors, Waymarked Trails', 18),

  // ── JusticeMap ───────────────────────────────────────────────────────
  xyz('justice-indian', 'American Indian', 'JusticeMap', 'https://www.justicemap.org/tile/county/indian/{z}/{x}/{y}.png', '© Justice Map', 18),
  xyz('justice-asian', 'Asian', 'JusticeMap', 'https://www.justicemap.org/tile/county/asian/{z}/{x}/{y}.png', '© Justice Map', 18),
  xyz('justice-black', 'Black', 'JusticeMap', 'https://www.justicemap.org/tile/county/black/{z}/{x}/{y}.png', '© Justice Map', 18),
  xyz('justice-hispanic', 'Hispanic', 'JusticeMap', 'https://www.justicemap.org/tile/county/hispanic/{z}/{x}/{y}.png', '© Justice Map', 18),
  xyz('justice-income', 'Income', 'JusticeMap', 'https://www.justicemap.org/tile/county/income/{z}/{x}/{y}.png', '© Justice Map', 18),
  xyz('justice-multi', 'Multi-racial', 'JusticeMap', 'https://www.justicemap.org/tile/county/multi/{z}/{x}/{y}.png', '© Justice Map', 18),
  xyz('justice-nonwhite', 'Non-White', 'JusticeMap', 'https://www.justicemap.org/tile/county/nonwhite/{z}/{x}/{y}.png', '© Justice Map', 18),
  xyz('justice-plurality', 'Plurality', 'JusticeMap', 'https://www.justicemap.org/tile/county/plural/{z}/{x}/{y}.png', '© Justice Map', 18),
  xyz('justice-white', 'White', 'JusticeMap', 'https://www.justicemap.org/tile/county/white/{z}/{x}/{y}.png', '© Justice Map', 18),

  // ── Gaode (China) ────────────────────────────────────────────────────
  xyz('gaode-normal', 'Normal', 'Gaode', 'http://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', '© Gaode.com'),
  xyz('gaode-satellite', 'Satellite', 'Gaode', 'http://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', '© Gaode.com'),

  // ── Other XYZ ────────────────────────────────────────────────────────
  xyz('freemapsk', 'FreeMap Slovakia', 'Other', 'https://a.freemap.sk/T/{z}/{x}/{y}.jpeg', '© OpenStreetMap contributors', 19),
  xyz('mtbmap', 'MTB Map', 'Other', 'http://tile.mtbmap.cz/mtbmap_tiles/{z}/{x}/{y}.png', '© OpenStreetMap contributors, USGS', 18),
  xyz('opnvkarte', 'OPNVKarte (Transit)', 'Other', 'https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png', '© memomaps.de CC-BY-SA, OpenStreetMap contributors', 18),
  xyz('openaip', 'OpenAIP (Aviation)', 'Other', 'https://1.tile.maps.openaip.net/geowebcache/service/tms/1.0.0/openaip_basemap@EPSG%3A900913@png/{z}/{x}/{y}.png', '© openAIP (CC-BY-NC-SA)', 14),
  xyz('openfiremap', 'OpenFireMap', 'Other', 'http://openfiremap.org/hytiles/{z}/{x}/{y}.png', '© OpenStreetMap contributors', 18),
  xyz('openrailwaymap', 'OpenRailwayMap', 'Other', 'https://a.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', '© OpenStreetMap contributors, OpenRailwayMap', 19),
  xyz('openseamap', 'OpenSeaMap', 'Other', 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', '© OpenSeaMap contributors', 18),
  xyz('opensnowmap', 'OpenSnowMap Pistes', 'Other', 'https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png', '© OpenStreetMap contributors, OpenSnowMap', 18),
  xyz('safecast', 'SafeCast (Radiation)', 'Other', 'https://s3.amazonaws.com/te512.safecast.org/{z}/{x}/{y}.png', '© SafeCast', 16),

  // ── WMS: USGS ────────────────────────────────────────────────────────
  wmsEntry('wms-usgs-3dep', '3DEP Elevation', 'USGS (WMS)', 'https://elevation.nationalmap.gov/arcgis/services/3DEPElevation/ImageServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-3dep-index', '3DEP Elevation Index', 'USGS (WMS)', 'https://index.nationalmap.gov/arcgis/services/3DEPElevationIndex/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-blank', 'Base Map (Blank)', 'USGS (WMS)', 'https://basemap.nationalmap.gov/arcgis/services/USGSTNMBlank/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-hydro', 'Hydrography', 'USGS (WMS)', 'https://basemap.nationalmap.gov/arcgis/services/USGSHydroCached/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-imagery-topo', 'Imagery + Topo', 'USGS (WMS)', 'https://basemap.nationalmap.gov/arcgis/services/USGSImageryTopo/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-imagery', 'Imagery Only', 'USGS (WMS)', 'https://basemap.nationalmap.gov/arcgis/services/USGSImageryOnly/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-relief', 'Shaded Relief', 'USGS (WMS)', 'https://basemap.nationalmap.gov/arcgis/services/USGSShadedReliefOnly/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-naip', 'NAIP Imagery', 'USGS (WMS)', 'https://imagery.nationalmap.gov/arcgis/services/USGSNAIPImagery/ImageServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-topo', 'Topo', 'USGS (WMS)', 'https://basemap.nationalmap.gov/arcgis/services/USGSTopo/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-topo-avail', 'Topo Availability', 'USGS (WMS)', 'https://index.nationalmap.gov/arcgis/services/USTopoAvailability/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-contours', 'Contours', 'USGS (WMS)', 'https://carto.nationalmap.gov/arcgis/services/contours/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-gnis', 'Geographic Names (GNIS)', 'USGS (WMS)', 'https://carto.nationalmap.gov/arcgis/services/geonames/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-govunits', 'Government Boundaries', 'USGS (WMS)', 'https://carto.nationalmap.gov/arcgis/services/govunits/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-naip-plus', 'Imagery (NAIP Plus)', 'USGS (WMS)', 'https://imagery.nationalmap.gov/arcgis/services/USGSNAIPPlus/ImageServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-map-indices', 'Map Indices', 'USGS (WMS)', 'https://carto.nationalmap.gov/arcgis/services/map_indices/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-nhdplus', 'NHDPlus High Resolution', 'USGS (WMS)', 'https://hydro.nationalmap.gov/arcgis/services/NHDPlus_HR/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-nhd', 'National Hydrography', 'USGS (WMS)', 'https://hydro.nationalmap.gov/arcgis/services/nhd/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-ref-poly', 'Reference Polygons', 'USGS (WMS)', 'https://carto.nationalmap.gov/arcgis/services/selectable_polygons/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-250k', 'Special Edition 250k Maps', 'USGS (WMS)', 'https://index.nationalmap.gov/arcgis/services/USGS_250K_Special_Edition_Maps/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-structures', 'Structures', 'USGS (WMS)', 'https://carto.nationalmap.gov/arcgis/services/structures/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-transport', 'Transportation', 'USGS (WMS)', 'https://carto.nationalmap.gov/arcgis/services/transportation/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-3dhp', '3D Hydrography (3DHP)', 'USGS (WMS)', 'https://hydro.nationalmap.gov/arcgis/services/3DHP_all/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-wbd', 'Watershed Boundary', 'USGS (WMS)', 'https://hydro.nationalmap.gov/arcgis/services/wbd/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-padus-fee', 'Protected Areas (Fee Manager)', 'USGS (WMS)', 'https://gis1.usgs.gov/arcgis/services/padus3/Fee_Managers/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-padus-gap', 'Protected Areas (GAP Status)', 'USGS (WMS)', 'https://gis1.usgs.gov/arcgis/services/padus3/Protection_Status_by_GAP_Status_Code/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-padus-mgr', 'Protected Areas (Manager Type)', 'USGS (WMS)', 'https://gis1.usgs.gov/arcgis/services/padus3/Manager_Type/MapServer/WMSServer', '0', '© USGS'),
  wmsEntry('wms-usgs-trails', 'Trails', 'USGS (WMS)', 'https://partnerships.nationalmap.gov/arcgis/services/USGSTrails/MapServer/WMSServer', '0', '© USGS'),

  // ── WMS: NLCD ────────────────────────────────────────────────────────
  wmsEntry('wms-nlcd-canopy', 'Canopy Cover', 'NLCD (WMS)', 'https://www.mrlc.gov/geoserver/NLCD_Canopy/wms', 'NLCD_Canopy', '© USGS MRLC'),
  wmsEntry('wms-nlcd-imperv-desc', 'Impervious Descriptor', 'NLCD (WMS)', 'https://www.mrlc.gov/geoserver/NLCD_Impervious_Descriptor/wms', 'NLCD_Impervious_Descriptor', '© USGS MRLC'),
  wmsEntry('wms-nlcd-imperv', 'Imperviousness', 'NLCD (WMS)', 'https://www.mrlc.gov/geoserver/NLCD_Impervious/wms', 'NLCD_Impervious', '© USGS MRLC'),
  wmsEntry('wms-nlcd-landcover', 'Land Cover', 'NLCD (WMS)', 'https://www.mrlc.gov/geoserver/NLCD_Land_Cover/wms', 'NLCD_Land_Cover', '© USGS MRLC'),
  wmsEntry('wms-nlcd-shrubland', 'Shrublands', 'NLCD (WMS)', 'https://www.mrlc.gov/geoserver/NLCD_Shrubland/wms', 'NLCD_Shrubland', '© USGS MRLC'),

  // ── WMS: US Federal ──────────────────────────────────────────────────
  wmsEntry('wms-blm-plss', 'Public Land Survey (PLSS)', 'BLM (WMS)', 'https://gis.blm.gov/arcgis/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/WMSServer', '0', '© BLM'),
  wmsEntry('wms-fws-wetlands', 'Wetlands', 'FWS (WMS)', 'https://www.fws.gov/wetlandsmapservice/services/Wetlands/MapServer/WMSServer', '0', '© FWS'),
  wmsEntry('wms-usgs-naip-4band', 'NAIP 4-Band', 'USGS (WMS)', 'https://imagery.nationalmap.gov/arcgis/services/USGSNAIPImagery/ImageServer/WMSServer', '0', '© USGS'),
];

// ─── Exports ──────────────────────────────────────────────────────────

export const DEFAULT_BASEMAP_ID = 'openstreetmap';

export function getBasemapById(id: string): BasemapDefinition | undefined {
  return BASEMAP_CATALOG.find((b) => b.id === id);
}
