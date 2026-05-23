/*
Runtime config for Interactive Recipe Finder

SECURITY NOTICE:
- DO NOT commit real API keys to source control.
- For local development: create a `config.local.js` (ignored by .gitignore) with:
  window.CONFIG = { BASE_URL: 'https://api.spoonacular.com/recipes', API_KEY: 'your_key' }
- For deployment (Vercel/Netlify): inject the API key at build/runtime using environment variables.
  Use: SPOONACULAR_API_KEY=your_key npm run generate-config
*/

// Default placeholder values — replace via deployment or local ignored file
window.CONFIG = window.CONFIG || {
    BASE_URL: 'https://api.spoonacular.com/recipes',
    API_KEY: 'REPLACE_WITH_YOUR_SPOONACULAR_API_KEY'
};

// Runtime check (non-blocking): warn in console if key is missing
if (!window.CONFIG.API_KEY || window.CONFIG.API_KEY.startsWith('REPLACE_')) {
    console.warn('%c⚠️ Recipe Finder: API key not configured', 'color: #ff6b6b; font-weight: bold;');
    console.warn('%cAdd it via config.local.js or your hosting environment. See README.md for details.', 'color: #666;');
}
