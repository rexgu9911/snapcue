export const config = {
  apiBaseUrl: import.meta.env.SNAPCUE_API_URL || 'http://localhost:3001',
  apiKey: import.meta.env.SNAPCUE_API_KEY || '',
  // snapcue-web base URL — used to build the /pricing deep link with the
  // Supabase session fragment. Defaults to Next.js dev default; production
  // build sets it via SNAPCUE_WEB_URL.
  webBaseUrl: import.meta.env.SNAPCUE_WEB_URL || 'http://localhost:3000',
}
