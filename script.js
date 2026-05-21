/* ==========================================
   Recipe Finder — Main Application Script
   ========================================== */

'use strict';

// ==========================================
// STATE
// ==========================================
const state = {
    ingredients: [],
    allRecipes: [],
    displayedCount: 0,
    currentFilters: { diet: '', cuisine: '', maxTime: '' },
    isLoading: false,
    errorTimer: null,
};

const RECIPES_PER_PAGE = (window.CONFIG && CONFIG.RECIPES_PER_PAGE) || 12;
const MAX_FETCH = (window.CONFIG && CONFIG.MAX_RECIPES_FETCH) || 30;

// Common ingredient suggestions for autocomplete
const INGREDIENT_SUGGESTIONS = [
    'chicken', 'beef', 'pork', 'salmon', 'shrimp', 'tofu', 'eggs',
    'tomato', 'onion', 'garlic', 'potato', 'carrot', 'broccoli', 'spinach',
    'pasta', 'rice', 'bread', 'flour', 'oats',
    'cheese', 'milk', 'butter', 'cream', 'yogurt',
    'olive oil', 'lemon', 'lime', 'avocado', 'mushroom', 'bell pepper',
    'zucchini', 'corn', 'peas', 'beans', 'lentils', 'chickpeas',
    'apple', 'banana', 'strawberry', 'blueberry',
    'basil', 'oregano', 'cumin', 'paprika', 'ginger', 'cilantro',
    'soy sauce', 'vinegar', 'honey', 'sugar', 'salt',
];

// ==========================================
// DOM REFERENCES
// ==========================================
const el = {
    ingredientInput: () => document.getElementById('ingredientInput'),
    addBtn: () => document.getElementById('addIngredientBtn'),
    ingredientsList: () => document.getElementById('ingredientsList'),
    searchBtn: () => document.getElementById('searchBtn'),
    searchHint: () => document.getElementById('searchHint'),
    dietFilter: () => document.getElementById('dietFilter'),
    cuisineFilter: () => document.getElementById('cuisineFilter'),
    maxTimeFilter: () => document.getElementById('maxTimeFilter'),
    loading: () => document.getElementById('loadingIndicator'),
    errorToast: () => document.getElementById('errorMessage'),
    errorText: () => document.getElementById('errorText'),
    resultsSection: () => document.getElementById('resultsSection'),
    resultsCount: () => document.getElementById('resultsCount'),
    recipeGrid: () => document.getElementById('recipeGrid'),
    modal: () => document.getElementById('recipeModal'),
    modalBackdrop: () => document.getElementById('modalBackdrop'),
    modalBody: () => document.getElementById('modalBody'),
    closeModal: () => document.getElementById('closeModal'),
    autocomplete: () => document.getElementById('ingredientSuggestions'),
    navStats: () => document.getElementById('navStats'),
    ingredientCountNav: () => document.getElementById('ingredientCountNav'),
    loadMoreContainer: () => document.getElementById('loadMoreContainer'),
};

// ==========================================
// INIT
// ==========================================
function init() {
    bindEvents();
    renderIngredients();
    updateSearchBtn();
    console.log('%c🍳 Recipe Finder Ready', 'color: #ff9c3c; font-weight: bold; font-size: 14px;');
}

// ==========================================
// EVENTS
// ==========================================
function bindEvents() {
    el.addBtn().addEventListener('click', addIngredient);
    el.ingredientInput().addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addIngredient(); }
        if (e.key === 'ArrowDown') { navigateSuggestions(1); e.preventDefault(); }
        if (e.key === 'ArrowUp') { navigateSuggestions(-1); e.preventDefault(); }
        if (e.key === 'Escape') { hideAutocomplete(); }
    });
    el.ingredientInput().addEventListener('input', handleAutocomplete);
    el.ingredientInput().addEventListener('blur', () => {
        setTimeout(hideAutocomplete, 150);
    });

    el.searchBtn().addEventListener('click', () => searchRecipes());
    el.dietFilter().addEventListener('change', updateFilters);
    el.cuisineFilter().addEventListener('change', updateFilters);
    el.maxTimeFilter().addEventListener('input', updateFilters);

    el.closeModal().addEventListener('click', closeModal);
    el.modalBackdrop().addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// ==========================================
// INGREDIENTS
// ==========================================
function addIngredient() {
    const raw = el.ingredientInput().value.trim();
    if (!raw) { showError('Please type an ingredient first.'); return; }

    const ingredient = raw.toLowerCase();
    if (state.ingredients.includes(ingredient)) {
        showError(`"${ingredient}" is already in your list.`);
        el.ingredientInput().value = '';
        hideAutocomplete();
        return;
    }

    state.ingredients.push(ingredient);
    el.ingredientInput().value = '';
    hideAutocomplete();
    renderIngredients();
    updateSearchBtn();
    hideError();
}

function removeIngredient(ingredient) {
    state.ingredients = state.ingredients.filter(i => i !== ingredient);
    renderIngredients();
    updateSearchBtn();
}

function renderIngredients() {
    const list = el.ingredientsList();
    const navStats = el.navStats();
    const countNav = el.ingredientCountNav();

    if (state.ingredients.length === 0) {
        list.innerHTML = `
            <div class="empty-ingredients">
                <i class="fas fa-seedling"></i>
                <span>Add ingredients above to get started</span>
            </div>`;
        navStats.style.display = 'none';
        return;
    }

    list.innerHTML = state.ingredients.map(ing => `
        <div class="ingredient-tag" role="listitem">
            <span>${escapeHtml(ing)}</span>
            <button class="tag-remove" onclick="removeIngredient('${escapeAttr(ing)}')"
                aria-label="Remove ${escapeAttr(ing)}">
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
        </div>
    `).join('');

    navStats.style.display = 'flex';
    const count = state.ingredients.length;
    countNav.textContent = `${count} ingredient${count !== 1 ? 's' : ''}`;
}

function updateSearchBtn() {
    const btn = el.searchBtn();
    const hint = el.searchHint();
    const hasIngredients = state.ingredients.length > 0;
    btn.disabled = !hasIngredients;
    hint.textContent = hasIngredients
        ? `Searching with ${state.ingredients.length} ingredient${state.ingredients.length > 1 ? 's' : ''}`
        : 'Add at least one ingredient to search';
}

// ==========================================
// AUTOCOMPLETE
// ==========================================
function handleAutocomplete(e) {
    const val = e.target.value.trim().toLowerCase();
    if (val.length < 2) { hideAutocomplete(); return; }

    const matches = INGREDIENT_SUGGESTIONS
        .filter(s => s.startsWith(val) && !state.ingredients.includes(s))
        .slice(0, 5);

    if (matches.length === 0) { hideAutocomplete(); return; }

    const container = el.autocomplete();
    container.innerHTML = matches.map(m => `
        <div class="suggestion-item" onclick="selectSuggestion('${escapeAttr(m)}')">
            <i class="fas fa-utensil-spoon" aria-hidden="true"></i>
            ${escapeHtml(m)}
        </div>
    `).join('');
    container.classList.add('visible');
}

function selectSuggestion(value) {
    el.ingredientInput().value = value;
    hideAutocomplete();
    addIngredient();
}

function hideAutocomplete() {
    const container = el.autocomplete();
    container.classList.remove('visible');
    container.innerHTML = '';
}

let activeSuggestionIdx = -1;
function navigateSuggestions(dir) {
    const items = el.autocomplete().querySelectorAll('.suggestion-item');
    if (!items.length) return;
    items[activeSuggestionIdx]?.classList.remove('active');
    activeSuggestionIdx = (activeSuggestionIdx + dir + items.length + 1) % (items.length + 1) - 0;
    if (activeSuggestionIdx >= items.length) activeSuggestionIdx = -1;
    if (activeSuggestionIdx >= 0) {
        items[activeSuggestionIdx].classList.add('active');
        el.ingredientInput().value = items[activeSuggestionIdx].textContent.trim();
    }
}

// ==========================================
// FILTERS
// ==========================================
function updateFilters() {
    state.currentFilters = {
        diet: el.dietFilter().value,
        cuisine: el.cuisineFilter().value,
        maxTime: el.maxTimeFilter().value,
    };
}

// ==========================================
// API — SEARCH RECIPES
// ==========================================
async function searchRecipes() {
    if (state.isLoading) return;
    updateFilters();

    const apiKey = (window.CONFIG && CONFIG.API_KEY) || '';
    if (!apiKey || apiKey === 'YOUR_SPOONACULAR_API_KEY_HERE') {
        showError('Please add your Spoonacular API key in config.js. Get a free key at spoonacular.com/food-api');
        return;
    }

    state.isLoading = true;
    state.allRecipes = [];
    state.displayedCount = 0;

    showLoading();
    hideError();
    el.resultsSection().classList.add('hidden');

    try {
        const params = new URLSearchParams({
            apiKey,
            includeIngredients: state.ingredients.join(','),
            number: MAX_FETCH,
            ranking: 2,
            ignorePantry: true,
            addRecipeInformation: true,
            fillIngredients: true,
            sort: 'max-used-ingredients',
        });

        if (state.currentFilters.diet) params.append('diet', state.currentFilters.diet);
        if (state.currentFilters.cuisine) params.append('cuisine', state.currentFilters.cuisine);
        if (state.currentFilters.maxTime) params.append('maxReadyTime', state.currentFilters.maxTime);

        const res = await fetch(`${CONFIG.BASE_URL}/complexSearch?${params}`);

        if (!res.ok) {
            if (res.status === 402) throw new Error('Daily API quota reached. Your limit resets tomorrow.');
            if (res.status === 401) throw new Error('Invalid API key. Please check your Spoonacular API key in config.js.');
            throw new Error(`API error (${res.status}). Please try again.`);
        }

        const data = await res.json();
        const raw = data.results || [];

        if (raw.length === 0) {
            hideLoading();
            showError('No recipes found with these ingredients. Try adding more or removing filters.');
            return;
        }

        state.allRecipes = raw
            .map(r => ({
                id: r.id,
                title: r.title,
                image: r.image || '',
                usedCount: r.usedIngredientCount || 0,
                missedCount: r.missedIngredientCount || 0,
                usedIngredients: r.usedIngredients || [],
                missedIngredients: r.missedIngredients || [],
                likes: r.aggregateLikes || 0,
                readyInMinutes: r.readyInMinutes || null,
                servings: r.servings || null,
                vegetarian: !!r.vegetarian,
                vegan: !!r.vegan,
                glutenFree: !!r.glutenFree,
                dairyFree: !!r.dairyFree,
                veryHealthy: !!r.veryHealthy,
            }))
            .sort((a, b) => {
                const scoreA = a.usedCount - a.missedCount * 0.5;
                const scoreB = b.usedCount - b.missedCount * 0.5;
                return scoreB - scoreA;
            });

        state.displayedCount = 0;
        hideLoading();
        renderMoreRecipes(true);
        el.resultsSection().classList.remove('hidden');
        setTimeout(() => {
            el.resultsSection().scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

    } catch (err) {
        console.error('[Recipe Finder]', err);
        showError(err.message || 'Failed to fetch recipes. Check your connection and try again.');
        hideLoading();
    } finally {
        state.isLoading = false;
    }
}

// ==========================================
// RECIPE DETAILS MODAL
// ==========================================
async function showRecipeDetails(id) {
    const apiKey = (window.CONFIG && CONFIG.API_KEY) || '';
    if (!apiKey || apiKey === 'YOUR_SPOONACULAR_API_KEY_HERE') return;

    el.modal().classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    el.modalBody().innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;padding:80px 20px;">
            <div class="fork-spinner" style="transform:scale(1.3);">
                <div class="fork-tine"></div>
                <div class="fork-tine"></div>
                <div class="fork-tine"></div>
            </div>
        </div>`;

    try {
        const res = await fetch(`${CONFIG.BASE_URL}/${id}/information?apiKey=${apiKey}`);
        if (!res.ok) throw new Error('Failed to load recipe details.');
        const r = await res.json();

        const dietTags = [
            r.vegetarian && '🌱 Vegetarian',
            r.vegan && '🥬 Vegan',
            r.glutenFree && '🌾 Gluten Free',
            r.dairyFree && '🥛 Dairy Free',
            r.veryHealthy && '💚 Very Healthy',
        ].filter(Boolean);

        const ingredients = r.extendedIngredients || [];
        const instructions = r.instructions || '';
        const cleanInstructions = instructions
            .replace(/<ol>/g, '<ol style="padding-left:20px">')
            .replace(/<li>/g, '<li style="margin-bottom:10px">');

        el.modalBody().innerHTML = `
            ${r.image ? `
                <div class="modal-img-wrap">
                    <img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.title)}" loading="lazy">
                </div>` : ''}

            <h2 class="modal-title" id="modalTitle">${escapeHtml(r.title)}</h2>

            <div class="modal-meta">
                ${r.readyInMinutes ? `<div class="meta-item"><i class="fas fa-clock"></i> <strong>${r.readyInMinutes}</strong> min</div>` : ''}
                ${r.servings ? `<div class="meta-item"><i class="fas fa-users"></i> <strong>${r.servings}</strong> servings</div>` : ''}
                ${r.healthScore ? `<div class="meta-item"><i class="fas fa-heart"></i> <strong>${r.healthScore}</strong> health score</div>` : ''}
                ${r.aggregateLikes ? `<div class="meta-item"><i class="fas fa-thumbs-up"></i> <strong>${r.aggregateLikes}</strong> likes</div>` : ''}
            </div>

            ${dietTags.length ? `
                <div class="modal-badges">
                    ${dietTags.map(t => `<span class="tag tag-diet">${t}</span>`).join('')}
                </div>` : ''}

            <h3 class="modal-section-title"><i class="fas fa-list-ul"></i> Ingredients (${ingredients.length})</h3>
            <ul class="ingredient-list">
                ${ingredients.map(ing => `
                    <li>
                        <i class="fas fa-circle" aria-hidden="true"></i>
                        ${escapeHtml(ing.original)}
                    </li>`).join('')}
            </ul>

            <h3 class="modal-section-title"><i class="fas fa-book-open"></i> Instructions</h3>
            <div class="instructions-text">
                ${cleanInstructions || '<p style="color:var(--text-muted)">Full instructions available at source.</p>'}
            </div>

            ${r.sourceUrl ? `
                <div class="view-original-btn">
                    <a href="${escapeHtml(r.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-search">
                        <i class="fas fa-external-link-alt"></i> View Full Recipe
                    </a>
                </div>` : ''}
        `;
    } catch (err) {
        el.modalBody().innerHTML = `
            <div style="padding:60px 20px;text-align:center;color:var(--text-muted);">
                <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:var(--error);margin-bottom:16px;display:block;"></i>
                <p>Could not load recipe details. Please try again.</p>
            </div>`;
    }
}

function closeModal() {
    el.modal().classList.add('hidden');
    document.body.style.overflow = '';
    el.modalBody().innerHTML = '';
}

// ==========================================
// RENDER RECIPES
// ==========================================
function renderMoreRecipes(reset = false) {
    if (reset) {
        el.recipeGrid().innerHTML = '';
        state.displayedCount = 0;
    }

    const start = state.displayedCount;
    const end = Math.min(start + RECIPES_PER_PAGE, state.allRecipes.length);
    const batch = state.allRecipes.slice(start, end);

    batch.forEach((r, i) => {
        const card = createRecipeCard(r);
        card.style.animationDelay = `${i * 0.05}s`;
        el.recipeGrid().appendChild(card);
    });

    state.displayedCount = end;
    updateResultsCount();
    updateLoadMoreBtn();
}

function loadMoreRecipes() {
    renderMoreRecipes(false);
    // Scroll to the first new card
    const cards = el.recipeGrid().querySelectorAll('.recipe-card');
    const targetCard = cards[state.displayedCount - (Math.min(RECIPES_PER_PAGE, state.displayedCount))];
    if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function createRecipeCard(r) {
    const total = r.usedCount + r.missedCount;
    const matchPct = total > 0 ? Math.round((r.usedCount / total) * 100) : 0;
    const dietTags = [
        r.vegetarian && 'Vegetarian',
        r.vegan && 'Vegan',
        r.glutenFree && 'GF',
        r.dairyFree && 'DF',
    ].filter(Boolean);

    const card = document.createElement('article');
    card.className = 'recipe-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', r.title);

    card.innerHTML = `
        <div class="recipe-img-wrap">
            <img
                src="${escapeHtml(r.image || 'https://via.placeholder.com/640x360/16162a/ff9c3c?text=Recipe')}"
                alt="${escapeHtml(r.title)}"
                class="recipe-image"
                loading="lazy"
                onerror="this.src='https://via.placeholder.com/640x360/16162a/ff9c3c?text=Recipe'"
            >
            <span class="match-badge">${matchPct}% match</span>
        </div>
        <div class="recipe-content">
            <h3 class="recipe-title">${escapeHtml(r.title)}</h3>
            <div class="recipe-meta">
                ${r.readyInMinutes ? `<div class="meta-item"><i class="fas fa-clock"></i> <strong>${r.readyInMinutes}</strong> min</div>` : ''}
                ${r.servings ? `<div class="meta-item"><i class="fas fa-users"></i> <strong>${r.servings}</strong> servings</div>` : ''}
                <div class="meta-item"><i class="fas fa-check-circle" style="color:var(--teal)"></i> <strong>${r.usedCount}</strong> matched</div>
            </div>
            <div class="recipe-tags">
                ${dietTags.map(t => `<span class="tag tag-diet">${t}</span>`).join('')}
                ${r.missedCount > 0 ? `<span class="tag tag-missing">+${r.missedCount} needed</span>` : ''}
            </div>
        </div>
    `;

    card.addEventListener('click', () => showRecipeDetails(r.id));
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showRecipeDetails(r.id); }
    });

    return card;
}

function updateResultsCount() {
    const total = state.allRecipes.length;
    const shown = state.displayedCount;
    el.resultsCount().innerHTML = `Showing <strong>${shown}</strong> of <strong>${total}</strong> recipes`;
}

function updateLoadMoreBtn() {
    const hasMore = state.displayedCount < state.allRecipes.length;
    const container = el.loadMoreContainer();
    if (hasMore) {
        const remaining = state.allRecipes.length - state.displayedCount;
        const nextBatch = Math.min(RECIPES_PER_PAGE, remaining);
        container.classList.remove('hidden');
        container.querySelector('.btn-outline span').textContent = `Load ${nextBatch} More Recipes`;
    } else {
        container.classList.add('hidden');
    }
}

function clearAll() {
    state.ingredients = [];
    state.allRecipes = [];
    state.displayedCount = 0;
    renderIngredients();
    updateSearchBtn();
    el.resultsSection().classList.add('hidden');
    el.recipeGrid().innerHTML = '';
    el.dietFilter().value = '';
    el.cuisineFilter().value = '';
    el.maxTimeFilter().value = '';
    hideError();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// UI HELPERS
// ==========================================
function showLoading() {
    el.loading().classList.remove('hidden');
}

function hideLoading() {
    el.loading().classList.add('hidden');
}

let errorTimer = null;
function showError(msg) {
    clearTimeout(errorTimer);
    el.errorText().textContent = msg;
    el.errorToast().classList.remove('hidden');
    errorTimer = setTimeout(hideError, CONFIG.ERROR_DISPLAY_MS || 6000);
}

function hideError() {
    el.errorToast().classList.add('hidden');
}

// ==========================================
// SECURITY HELPERS
// ==========================================
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/'/g, "\\'");
}

// ==========================================
// BOOT
// ==========================================
document.addEventListener('DOMContentLoaded', init);
