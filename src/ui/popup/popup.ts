/**
 * MapLayout Pro — Popup Script
 *
 * Quick search + open designer tab.
 */

const searchInput = document.getElementById('place-search') as HTMLInputElement;
const searchResults = document.getElementById('search-results') as HTMLUListElement;
const openDesignerBtn = document.getElementById('open-designer') as HTMLButtonElement;

// Debounce timer for geocoding
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

/** Geocode a place name via Nominatim */
async function geocodeSearch(query: string): Promise<void> {
  if (query.length < 2) {
    searchResults.classList.add('hidden');
    return;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'MapLayoutPro/0.1 (browser-extension)' },
    });
    const results = await response.json();

    searchResults.innerHTML = '';
    if (results.length === 0) {
      searchResults.innerHTML = '<li>No results found</li>';
    } else {
      for (const r of results) {
        const li = document.createElement('li');
        li.innerHTML = `
          <span class="result-name">${escapeHtml(r.display_name.split(',')[0])}</span>
          <span class="result-type">${escapeHtml(r.type)}</span>
          <br><small style="color:#94a3b8">${escapeHtml(r.display_name)}</small>
        `;
        li.addEventListener('click', () => openDesignerWithPlace(r));
        searchResults.appendChild(li);
      }
    }
    searchResults.classList.remove('hidden');
  } catch (err) {
    console.error('Geocoding failed:', err);
  }
}

/** Open designer tab with a geocoded place */
function openDesignerWithPlace(result: {
  lat: string;
  lon: string;
  display_name: string;
  osm_type?: string;
  osm_id?: string;
  boundingbox?: string[];
}): void {
  const params: Record<string, string> = {
    lat: result.lat,
    lon: result.lon,
    name: result.display_name.split(',')[0],
    display_name: result.display_name,
  };
  if (result.boundingbox) {
    params.bbox = result.boundingbox.join(',');
  }
  if (result.osm_type && result.osm_id) {
    params.osm_type = result.osm_type;
    params.osm_id = result.osm_id;
  }

  chrome.runtime.sendMessage({ action: 'openDesigner', params });
  window.close();
}

/** Open designer without a pre-selected place */
openDesignerBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'openDesigner' });
  window.close();
});

/** Debounced search */
searchInput.addEventListener('input', () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    geocodeSearch(searchInput.value.trim());
  }, 400);
});

// Close results on outside click
document.addEventListener('click', (e) => {
  if (!(e.target as Element).closest('.search-section')) {
    searchResults.classList.add('hidden');
  }
});

/** Simple HTML escape */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
