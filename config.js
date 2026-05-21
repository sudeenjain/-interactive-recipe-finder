// ==========================================
// Recipe Finder — Configuration
// ==========================================
// Environment configuration
// In production, set VITE_SPOONACULAR_API_KEY as environment variable
// For local development, replace the value below with your key

const CONFIG = {
    // Spoonacular API — https://spoonacular.com/food-api
    // Free tier: 150 requests/day
    API_KEY: (typeof window !== 'undefined' && window.__ENV && window.__ENV.SPOONACULAR_API_KEY)
        || 'YOUR_SPOONACULAR_API_KEY_HERE',
    BASE_URL: 'https://api.spoonacular.com/recipes',

    // App settings
    RECIPES_PER_PAGE: 12,
    MAX_RECIPES_FETCH: 30,
    ERROR_DISPLAY_MS: 6000,
};

// Expose globally
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}
