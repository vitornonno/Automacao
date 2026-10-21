# Cleaning Route Relay

Cloudflare Worker used by the Chrome extension to calculate driving time through Mapbox Directions. It deliberately exposes only duration and distance to the extension; the Mapbox token remains a Worker secret.

## One-time Mapbox setup

1. Create a Mapbox account and copy its Default public token (`pk...`).
2. Keep this token out of `chrome-extension` and out of chat.

The relay uses Mapbox's `driving-traffic` profile. See the [official Directions documentation](https://docs.mapbox.com/api/navigation/directions/).

## Deploy

From this directory, authenticate with Cloudflare and deploy the Worker:

```powershell
npx wrangler login
npx wrangler deploy
```

Then store both secrets in the Worker:

```powershell
npx wrangler secret put MAPBOX_ACCESS_TOKEN
npx wrangler secret put EXTENSION_TOKEN
```

Use a long random value for `EXTENSION_TOKEN`. It authenticates requests from the local extension to this relay; it is not the Mapbox token.

## Endpoint

`POST /routes`, with `Authorization: Bearer <EXTENSION_TOKEN>` and a body like:

```json
{
  "origin": { "latitude": 37.9029281, "longitude": -122.033732 },
  "destination": { "latitude": 37.896, "longitude": -122.06 }
}
```

The response contains `durationSeconds` and `distanceMeters`. Coordinates are required; Presto exposes these through its Google Maps link.

## Safety

- This Worker is read-only: it cannot create or change Presto jobs.
- It only accepts `POST /routes` from callers presenting the extension token.
- The Mapbox token remains on Cloudflare as a secret.
