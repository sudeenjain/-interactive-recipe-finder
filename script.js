// ===== Configuration =====
// CONFIG is loaded from config.js file
// This keeps API keys secure and out of version control

// ===== State Management =====
const state = {
    ingredients: [],
    recipes: [],
    allRecipes: [], // Store all fetched recipes
    displayedRecipes: [], // Currently displayed recipes
    displayedCount: 0, // Track how many recipes are currently displayed
    totalAvailable: 0, // Total recipes available from API
    recipesPerLoad: 10, // How many to show at a time
    currentFilters: {
        diet: '',
        cuisine: '',
        maxTime: ''
    }
};

// ===== DOM Elements =====
const elements = {
    ingredientInput: document.getElementById('ingredientInput'),
    addIngredientBtn: document.getElementById('addIngredientBtn'),
    ingredientsList: document.getElementById('ingredientsList'),
    searchBtn: document.getElementById('searchBtn'),
    dietFilter: document.getElementById('dietFilter'),
    cuisineFilter: document.getElementById('cuisineFilter'),
    maxTimeFilter: document.getElementById('maxTimeFilter'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    errorMessage: document.getElementById('errorMessage'),
    resultsSection: document.getElementById('resultsSection'),
    resultsCount: document.getElementById('resultsCount'),
    recipeGrid: document.getElementById('recipeGrid'),
    recipeModal: document.getElementById('recipeModal'),
    modalBody: document.getElementById('modalBody'),
    closeModal: document.getElementById('closeModal'),
    themeToggle: document.getElementById('themeToggle')
};

// ===== Event Listeners =====
function initEventListeners() {
    // Add ingredient
    elements.addIngredientBtn.addEventListener('click', addIngredient);
    elements.ingredientInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addIngredient();
    });

    // Search recipes
    elements.searchBtn.addEventListener('click', searchRecipes);

    // Filters
    elements.dietFilter.addEventListener('change', updateFilters);
    elements.cuisineFilter.addEventListener('change', updateFilters);
    elements.maxTimeFilter.addEventListener('input', updateFilters);

    // Modal
    elements.closeModal.addEventListener('click', closeModal);
    elements.recipeModal.querySelector('.modal-overlay').addEventListener('click', closeModal);

    // Dark mode toggle
    elements.themeToggle.addEventListener('click', toggleTheme);

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// ===== Ingredient Management =====
function addIngredient() {
    const ingredient = elements.ingredientInput.value.trim().toLowerCase();
    
    if (!ingredient) {
        showError('Please enter an ingredient');
        return;
    }

    if (state.ingredients.includes(ingredient)) {
        showError('Ingredient already added');
        return;
    }

    state.ingredients.push(ingredient);
    elements.ingredientInput.value = '';
    renderIngredients();
    updateSearchButton();
    hideError();
}

function removeIngredient(ingredient) {
    state.ingredients = state.ingredients.filter(item => item !== ingredient);
    renderIngredients();
    updateSearchButton();
}

function renderIngredients() {
    if (state.ingredients.length === 0) {
        elements.ingredientsList.innerHTML = '<p style="text-align: center; color: var(--text-light); width: 100%;">No ingredients added yet. Start by adding some!</p>';
        return;
    }

    elements.ingredientsList.innerHTML = state.ingredients.map(ingredient => `
        <div class="ingredient-tag">
            <span>${ingredient}</span>
            <i class="fas fa-times" onclick="removeIngredient('${ingredient}')"></i>
        </div>
    `).join('');
}

function updateSearchButton() {
    elements.searchBtn.disabled = state.ingredients.length === 0;
}

// ===== Filter Management =====
function updateFilters() {
    state.currentFilters = {
        diet: elements.dietFilter.value,
        cuisine: elements.cuisineFilter.value,
        maxTime: elements.maxTimeFilter.value
    };
}

// ===== Theme Management =====
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update icon
    const icon = elements.themeToggle.querySelector('i');
    icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        const icon = elements.themeToggle.querySelector('i');
        icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    } else if (prefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        const icon = elements.themeToggle.querySelector('i');
        icon.className = 'fas fa-sun';
    }
}

// ===== API Functions =====
async function searchRecipes(loadMore = false) {
    if (!window.CONFIG || !CONFIG.API_KEY || CONFIG.API_KEY.startsWith('REPLACE_')) {
        showError('Spoonacular API key missing. Configure it in config.js or via your hosting environment (see README).');
        return;
    }

    showLoading();
    hideError();

    if (!loadMore) {
        elements.resultsSection.classList.remove('hidden');
        state.allRecipes = [];
        state.displayedRecipes = [];
        state.displayedCount = 0;
        renderSkeletonLoader();
    }

    try {
        // Use complexSearch endpoint with filters - ONLY 1 API CALL!
        // This endpoint supports diet, cuisine, and time filters
        const params = new URLSearchParams({
            apiKey: CONFIG.API_KEY,
            includeIngredients: state.ingredients.join(','),
            number: 30, // Get 30 results
            ranking: 2, // Maximize used ingredients
            ignorePantry: true,
            addRecipeInformation: true, // Get basic info including diet tags
            fillIngredients: true, // Get ingredient match info
            instructionsRequired: false,
            sort: 'max-used-ingredients'
        });

        // Add diet filter if selected
        if (state.currentFilters.diet) {
            params.append('diet', state.currentFilters.diet);
        }

        // Add cuisine filter if selected
        if (state.currentFilters.cuisine) {
            params.append('cuisine', state.currentFilters.cuisine);
        }

        // Add max time filter if selected
        if (state.currentFilters.maxTime) {
            params.append('maxReadyTime', state.currentFilters.maxTime);
        }

        const response = await fetch(`${CONFIG.BASE_URL}/complexSearch?${params}`);

        if (!response.ok) {
            if (response.status === 402) {
                throw new Error('API quota exceeded. Your limit resets tomorrow. Each search uses 1 API call now!');
            }
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        let recipes = data.results || [];

        console.log(`Found ${recipes.length} recipes matching your ingredients`);
        console.log(`Filters applied: Diet=${state.currentFilters.diet || 'none'}, Cuisine=${state.currentFilters.cuisine || 'none'}, MaxTime=${state.currentFilters.maxTime || 'none'}`);

        // Transform the recipe data - complexSearch includes more info!
        const transformedRecipes = recipes.map(recipe => ({
            id: recipe.id,
            title: recipe.title,
            image: recipe.image,
            // Get ingredient counts from nutrition object if available
            usedIngredientCount: recipe.usedIngredientCount || 0,
            missedIngredientCount: recipe.missedIngredientCount || 0,
            usedIngredients: recipe.usedIngredients || [],
            missedIngredients: recipe.missedIngredients || [],
            likes: recipe.aggregateLikes || 0,
            // Now we have these fields from complexSearch!
            readyInMinutes: recipe.readyInMinutes || null,
            servings: recipe.servings || null,
            vegetarian: recipe.vegetarian || false,
            vegan: recipe.vegan || false,
            glutenFree: recipe.glutenFree || false,
            dairyFree: recipe.dairyFree || false,
            veryHealthy: recipe.veryHealthy || false,
            cheap: recipe.cheap || false,
            sustainable: recipe.sustainable || false
        }));

        // Filters are already applied by the API!
        let filteredRecipes = transformedRecipes;

        // Sort by most matched ingredients
        filteredRecipes.sort((a, b) => {
            const aScore = (a.usedIngredientCount || 0) - (a.missedIngredientCount || 0);
            const bScore = (b.usedIngredientCount || 0) - (b.missedIngredientCount || 0);
            return bScore - aScore;
        });

        state.allRecipes = filteredRecipes;
        state.totalAvailable = filteredRecipes.length;

        // Show first batch
        state.displayedCount = Math.min(state.recipesPerLoad, state.allRecipes.length);
        state.displayedRecipes = state.allRecipes.slice(0, state.displayedCount);
        state.recipes = state.displayedRecipes;

        if (state.recipes.length === 0) {
            showError('No recipes found with these ingredients. Try different combinations!');
            hideLoading();
            return;
        }

        console.log(`Displaying ${state.recipes.length} recipes (${state.totalAvailable} total)`);
        console.log(`✅ Used only 1 API call!`);

        renderRecipes();
        hideLoading();
        elements.resultsSection.classList.remove('hidden');

        // Smooth scroll to results
        if (!loadMore) {
            elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

    } catch (error) {
        console.error('Error fetching recipes:', error);
        showError(error.message || 'Failed to fetch recipes. Please check your API key and internet connection.');
        hideLoading();
    }
}

async function getRecipeDetails(recipeId) {
    try {
        const response = await fetch(
            `${CONFIG.BASE_URL}/${recipeId}/information?apiKey=${CONFIG.API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching recipe details:', error);
        showError('Failed to load recipe details');
        return null;
    }
}

// ===== Rendering Functions =====
function renderSkeletonLoader() {
    const skeletonHTML = Array(6).fill(0).map(() => `
        <div class="skeleton-card">
            <div class="skeleton skeleton-image"></div>
            <div class="skeleton-content">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-meta"></div>
                <div class="skeleton skeleton-meta" style="width: 40%"></div>
                <div class="skeleton skeleton-badge"></div>
                <div class="skeleton skeleton-badge"></div>
            </div>
        </div>
    `).join('');

    elements.recipeGrid.innerHTML = skeletonHTML;
}

function renderRecipes() {
    // Update count with more detailed information
    const countText = state.totalAvailable > state.displayedCount
        ? `Showing ${state.displayedCount} of ${state.totalAvailable} recipes`
        : `Found ${state.recipes.length} delicious recipes!`;

    elements.resultsCount.textContent = countText;

    elements.recipeGrid.innerHTML = state.recipes.map(recipe => {
        const usedIngredients = recipe.usedIngredientCount || 0;
        const missedIngredients = recipe.missedIngredientCount || 0;
        const totalIngredients = usedIngredients + missedIngredients;

        return `
            <div class="recipe-card" onclick="showRecipeDetails(${recipe.id})">
                <img
                    src="${recipe.image || 'https://via.placeholder.com/300x200?text=No+Image'}"
                    alt="${recipe.title}"
                    class="recipe-image"
                    loading="lazy"
                    decoding="async"
                    width="300"
                    height="200"
                >
                <div class="recipe-content">
                    <h3 class="recipe-title">${recipe.title}</h3>

                    <div class="recipe-meta">
                        ${recipe.readyInMinutes ? `
                            <div class="meta-item">
                                <i class="fas fa-clock"></i>
                                <span>${recipe.readyInMinutes} min</span>
                            </div>
                        ` : ''}
                        ${recipe.servings ? `
                            <div class="meta-item">
                                <i class="fas fa-users"></i>
                                <span>${recipe.servings} servings</span>
                            </div>
                        ` : ''}
                        <div class="meta-item">
                            <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
                            <span><strong>${usedIngredients}</strong> matched</span>
                        </div>
                    </div>

                    <div class="recipe-badges" style="margin-top: 0.75rem;">
                        <span class="badge" style="background: var(--success-color); color: white;">
                            ${Math.round((usedIngredients / Math.max(totalIngredients, 1)) * 100)}% Match
                        </span>
                        ${recipe.vegetarian ? '<span class="badge">🌱 Vegetarian</span>' : ''}
                        ${recipe.vegan ? '<span class="badge">🥬 Vegan</span>' : ''}
                        ${recipe.glutenFree ? '<span class="badge">🌾 Gluten Free</span>' : ''}
                        ${recipe.dairyFree ? '<span class="badge">🥛 Dairy Free</span>' : ''}
                    </div>

                    ${missedIngredients > 0 ? `
                        <div class="missing-ingredients">
                            <p>
                                <span class="missing-count">${missedIngredients}</span>
                                additional ingredient${missedIngredients > 1 ? 's' : ''} needed
                            </p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Add or update Load More button
    updateLoadMoreButton();
}

function updateLoadMoreButton() {
    // Remove existing button if present
    const existingBtn = document.getElementById('loadMoreBtn');
    if (existingBtn) {
        existingBtn.remove();
    }

    // Check if there are more recipes to load from already fetched results
    const hasMore = state.displayedCount < state.totalAvailable;

    if (hasMore) {
        const remaining = state.totalAvailable - state.displayedCount;
        const nextBatch = Math.min(state.recipesPerLoad, remaining);

        const loadMoreBtn = document.createElement('div');
        loadMoreBtn.id = 'loadMoreBtn';
        loadMoreBtn.className = 'load-more-container';
        loadMoreBtn.innerHTML = `
            <button class="btn btn-search" onclick="loadMoreRecipes()">
                <i class="fas fa-plus-circle"></i>
                Load More Recipes (${nextBatch} more available)
            </button>
        `;
        elements.recipeGrid.insertAdjacentElement('afterend', loadMoreBtn);
    }
}

function loadMoreRecipes() {
    // Load next batch from already fetched recipes
    const nextCount = Math.min(
        state.displayedCount + state.recipesPerLoad,
        state.totalAvailable
    );

    state.displayedRecipes = state.allRecipes.slice(0, nextCount);
    state.recipes = state.displayedRecipes;
    state.displayedCount = nextCount;

    renderRecipes();

    // Smooth scroll to the new recipes
    const recipeCards = document.querySelectorAll('.recipe-card');
    if (recipeCards.length > state.displayedCount - state.recipesPerLoad) {
        recipeCards[state.displayedCount - state.recipesPerLoad].scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
}

async function showRecipeDetails(recipeId) {
    showLoading();
    console.log('📖 Fetching recipe details (uses 1 API call)...');
    const recipe = await getRecipeDetails(recipeId);
    hideLoading();

    if (!recipe) return;

    const instructions = recipe.instructions || 'Instructions not available.';
    const ingredients = recipe.extendedIngredients || [];

    elements.modalBody.innerHTML = `
        <div style="clear: both;">
            <img 
                src="${recipe.image}" 
                alt="${recipe.title}"
                style="width: 100%; border-radius: 12px; margin-bottom: 1.5rem;"
                loading="eager"
                decoding="async"
                width="800"
                height="600"
            >
            
            <h2 style="margin-bottom: 1rem; color: var(--text-dark);">${recipe.title}</h2>
            
            <div style="display: flex; gap: 2rem; margin-bottom: 2rem; flex-wrap: wrap;">
                <div class="meta-item">
                    <i class="fas fa-clock"></i>
                    <span><strong>${recipe.readyInMinutes}</strong> minutes</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-users"></i>
                    <span><strong>${recipe.servings}</strong> servings</span>
                </div>
                ${recipe.healthScore ? `
                    <div class="meta-item">
                        <i class="fas fa-heart"></i>
                        <span><strong>${recipe.healthScore}</strong> health score</span>
                    </div>
                ` : ''}
            </div>

            <div style="margin-bottom: 2rem;">
                ${recipe.vegetarian ? '<span class="badge">🌱 Vegetarian</span>' : ''}
                ${recipe.vegan ? '<span class="badge">🥬 Vegan</span>' : ''}
                ${recipe.glutenFree ? '<span class="badge">🌾 Gluten Free</span>' : ''}
                ${recipe.dairyFree ? '<span class="badge">🥛 Dairy Free</span>' : ''}
                ${recipe.veryHealthy ? '<span class="badge">💚 Very Healthy</span>' : ''}
            </div>

            <h3 style="margin: 2rem 0 1rem; color: var(--primary-color);">
                <i class="fas fa-list"></i> Ingredients
            </h3>
            <ul style="list-style: none; padding: 0;">
                ${ingredients.map(ing => `
                    <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                        <i class="fas fa-check" style="color: var(--success-color); margin-right: 0.5rem;"></i>
                        ${ing.original}
                    </li>
                `).join('')}
            </ul>

            <h3 style="margin: 2rem 0 1rem; color: var(--primary-color);">
                <i class="fas fa-book"></i> Instructions
            </h3>
            <div style="line-height: 1.8; color: var(--text-dark);">
                ${instructions.replace(/<ol>/g, '<ol style="padding-left: 1.5rem;">')
                            .replace(/<li>/g, '<li style="margin-bottom: 1rem;">')}
            </div>

            ${recipe.sourceUrl ? `
                <div style="margin-top: 2rem; text-align: center;">
                    <a href="${recipe.sourceUrl}" target="_blank" class="btn btn-primary">
                        <i class="fas fa-external-link-alt"></i> View Original Recipe
                    </a>
                </div>
            ` : ''}
        </div>
    `;

    elements.recipeModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    elements.recipeModal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// ===== UI Helper Functions =====
function showLoading() {
    elements.loadingIndicator.classList.remove('hidden');
}

function hideLoading() {
    elements.loadingIndicator.classList.add('hidden');
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
    setTimeout(hideError, 5000);
}

function hideError() {
    elements.errorMessage.classList.add('hidden');
}

// ===== Initialization =====
function init() {
    initEventListeners();
    initTheme();
    renderIngredients();
    updateSearchButton();
    
    console.log('%c🍳 Recipe Finder Initialized!', 'color: #ff6b6b; font-size: 16px; font-weight: bold;');
    console.log('%cConfigure your Spoonacular API key via config.js or your hosting environment (see README).', 'color: #4ecdc4; font-size: 12px;');
}

// Start the app
document.addEventListener('DOMContentLoaded', init);