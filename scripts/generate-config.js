/*
Generate a runtime `config.js` from environment variables during build.
Usage (build-time):
  SPOONACULAR_API_KEY=your_key node scripts/generate-config.js
This writes `config.js` in the project root. Do NOT commit real keys.
*/

const fs = require('fs');
const path = require('path');

const key = process.env.SPOONACULAR_API_KEY || process.env.SPOONACULAR_KEY || '';

const content = `// Auto-generated config.js - do not commit real keys to source control\nwindow.CONFIG = {\n  BASE_URL: 'https://api.spoonacular.com/recipes',\n  API_KEY: '${key || 'REPLACE_WITH_YOUR_SPOONACULAR_API_KEY'}'\n};\n`;

fs.writeFileSync(path.join(__dirname, '..', 'config.js'), content, { encoding: 'utf8' });
console.log('Wrote config.js (SPOONACULAR_API_KEY set:', !!key, ')');
