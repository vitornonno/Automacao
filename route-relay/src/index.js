const MAPBOX_DIRECTIONS_BASE_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic';
const MAPBOX_GEOCODE_URL = 'https://api.mapbox.com/search/geocode/v6/forward';

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': origin.startsWith('chrome-extension://') ? origin : 'null',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function routePoint(point) {
  if (!point || typeof point !== 'object') return null;
  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
    return { latitude, longitude };
  }
  return null;
}

function authorized(request, token) {
  const header = request.headers.get('Authorization') || '';
  return Boolean(token) && header === `Bearer ${token}`;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') return json(request, { ok: true });
    if (!['/routes', '/geocode'].includes(url.pathname) || request.method !== 'POST') return json(request, { error: 'Not found.' }, 404);
    if (!authorized(request, env.EXTENSION_TOKEN)) return json(request, { error: 'Unauthorized.' }, 401);
    if (!env.MAPBOX_ACCESS_TOKEN) return json(request, { error: 'Routes service is not configured.' }, 503);

    let input;
    try { input = await request.json(); } catch { return json(request, { error: 'Invalid JSON body.' }, 400); }
    if (url.pathname === '/geocode') {
      const query = String(input.query || '').trim();
      if (!query) return json(request, { error: 'A location query is required.' }, 400);
      const geocodeUrl = new URL(MAPBOX_GEOCODE_URL);
      geocodeUrl.searchParams.set('q', query);
      geocodeUrl.searchParams.set('country', 'us');
      if (input.region === 'california') {
        // Both companies operate in California. Restrict ambiguous place names (for example,
        // "Concord") to the state instead of accepting a same-named city elsewhere in the US.
        geocodeUrl.searchParams.set('bbox', '-124.482003,32.528289,-114.131211,42.009518');
        geocodeUrl.searchParams.set('proximity', '-121.9886,37.9780');
      }
      geocodeUrl.searchParams.set('limit', '1');
      geocodeUrl.searchParams.set('access_token', env.MAPBOX_ACCESS_TOKEN);
      const response = await fetch(geocodeUrl);
      const payload = await response.json();
      if (!response.ok) return json(request, { error: 'Mapbox Geocoding request failed.', detail: payload.message || null }, 502);
      const feature = payload.features?.[0];
      const coordinates = feature?.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return json(request, { error: 'Location not found.' }, 422);
      return json(request, { latitude: coordinates[1], longitude: coordinates[0], label: feature.properties?.full_address || feature.place_formatted || feature.name || query, approximate: true });
    }
    const origin = routePoint(input.origin);
    const destination = routePoint(input.destination);
    if (!origin || !destination) return json(request, { error: 'Origin and destination require valid coordinates.' }, 400);

    const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const mapboxUrl = new URL(`${MAPBOX_DIRECTIONS_BASE_URL}/${coordinates}`);
    mapboxUrl.searchParams.set('access_token', env.MAPBOX_ACCESS_TOKEN);
    mapboxUrl.searchParams.set('overview', 'false');
    mapboxUrl.searchParams.set('steps', 'false');
    const response = await fetch(mapboxUrl);
    const payload = await response.json();
    if (!response.ok) return json(request, { error: 'Mapbox Directions request failed.', detail: payload.message || null }, 502);
    const route = payload.routes?.[0];
    if (!route) return json(request, { error: 'No route found.' }, 422);
    return json(request, {
      durationSeconds: Number.isFinite(route.duration) ? Math.round(route.duration) : null,
      distanceMeters: Number.isFinite(route.distance) ? Math.round(route.distance) : null,
      fetchedAt: new Date().toISOString()
    });
  }
};
