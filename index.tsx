/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

interface Innovation {
    name: string;
    description: string;
    category: string;
    imageQuery: string;
    learnMoreUrl: string;
    significance: string;
}

let allInnovations: Innovation[] = [];

// DOM Elements
const loader = document.getElementById('loader') as HTMLDivElement;
const dashboard = document.getElementById('dashboard') as HTMLDivElement;
const errorMessage = document.getElementById('error-message') as HTMLDivElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const categoryFilters = document.getElementById('category-filters') as HTMLDivElement;
const spotlightContainer = document.getElementById('spotlight') as HTMLDivElement;
const noResultsMessage = document.getElementById('no-results-message') as HTMLDivElement;

/**
 * Creates a card element for each innovation.
 */
function createCard(innovation: Innovation): HTMLElement {
    const card = document.createElement('div');
    card.className = 'card';
    
    // Using a more dynamic Unsplash source for thematic images
    const imageUrl = `https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=600&h=400&sig=${Math.random()}`;
    // Actually using a specific query-based placeholder service is better:
    const specificImage = `https://loremflickr.com/600/400/${encodeURIComponent(innovation.imageQuery)}`;

    card.innerHTML = `
        <div class="card-img-container">
            <img src="${specificImage}" alt="${innovation.name}" class="card-img" loading="lazy">
        </div>
        <div class="card-content">
            <span class="card-category">${innovation.category}</span>
            <h3 class="card-title">${innovation.name}</h3>
            <p class="card-description">${innovation.description}</p>
            <div class="card-footer">
                <a href="${innovation.learnMoreUrl}" target="_blank" class="card-btn">Wiki</a>
            </div>
        </div>
    `;

    card.addEventListener('click', () => updateSpotlight(innovation));
    return card;
}

/**
 * Updates the Spotlight section with detailed view.
 */
function updateSpotlight(innovation: Innovation) {
    spotlightContainer.innerHTML = `
        <div class="spotlight-card glass">
            <div class="spotlight-content">
                <span class="spotlight-tag">${innovation.category}</span>
                <h2 class="spotlight-title">${innovation.name}</h2>
                <p class="spotlight-desc">${innovation.significance}</p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <a href="${innovation.learnMoreUrl}" target="_blank" class="card-btn" style="background: var(--primary); padding: 0.75rem 1.5rem;">Read Full Source</a>
                    <button class="card-btn" style="padding: 0.75rem 1.5rem;" onclick="window.scrollTo({top: document.getElementById('dashboard').offsetTop - 150, behavior: 'smooth'})">Back to Grid</button>
                </div>
            </div>
        </div>
    `;
    spotlightContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Sets up category filter buttons.
 */
function setupFilters(innovations: Innovation[]) {
    const categories = Array.from(new Set(innovations.map(i => i.category))).sort();
    
    // Clear and rebuild filters (excluding "All Tech" which is in HTML)
    const existingPills = categoryFilters.querySelectorAll('.filter-pill:not([data-category="all"])');
    existingPills.forEach(p => p.remove());

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'filter-pill';
        btn.textContent = cat;
        btn.dataset.category = cat;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            filterInnovations(searchInput.value, cat);
        });
        categoryFilters.appendChild(btn);
    });

    // Handle "All" pill click
    const allPill = categoryFilters.querySelector('[data-category="all"]');
    allPill?.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        allPill.classList.add('active');
        filterInnovations(searchInput.value, 'all');
    });
}

/**
 * Filters the cards based on text search and category.
 */
function filterInnovations(query: string, category: string) {
    const normalizedQuery = query.toLowerCase().trim();
    const activeCategory = category === 'all' ? null : category;

    const filtered = allInnovations.filter(innovation => {
        const matchesQuery = innovation.name.toLowerCase().includes(normalizedQuery) || 
                             innovation.description.toLowerCase().includes(normalizedQuery);
        const matchesCategory = !activeCategory || innovation.category === activeCategory;
        return matchesQuery && matchesCategory;
    });

    renderGrid(filtered);

    if (noResultsMessage) {
        noResultsMessage.style.display = filtered.length === 0 ? 'block' : 'none';
        noResultsMessage.textContent = `No breakthroughs found for "${query}" in ${category}...`;
    }
}

/**
 * Renders the grid of innovation cards.
 */
function renderGrid(innovations: Innovation[]) {
    dashboard.innerHTML = '';
    innovations.forEach(innovation => {
        dashboard.appendChild(createCard(innovation));
    });
}

/**
 * Core function to fetch innovations using Gemini 3 and Google Search grounding.
 */
async function run() {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    category: { type: Type.STRING },
                    imageQuery: { type: Type.STRING },
                    learnMoreUrl: { type: Type.STRING },
                    significance: { type: Type.STRING, description: "A deeper 2-3 sentence explanation of why this matters." }
                },
                required: ["name", "description", "category", "imageQuery", "learnMoreUrl", "significance"]
            }
        };

        const prompt = `Generate a high-quality list of 50 significant technological innovations that have shaped or are currently shaping humanity as of 2024-2025. 
        Include a mix of historic (e.g. Printing Press) and cutting-edge (e.g. LLMs, Quantum Computing, CRISPR). 
        Categorize them into fields like: 'Energy', 'Medicine', 'AI & Robotics', 'Space', 'Communication', 'Computing'.
        For each, provide a valid URL (preferably Wikipedia) verified via search.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        const data: Innovation[] = JSON.parse(response.text);
        allInnovations = data;

        // Extract grounding if available to show we have verification
        if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            console.log("Verified sources found via Google Search Grounding");
        }

        if (loader) loader.style.display = 'none';
        
        setupFilters(allInnovations);
        renderGrid(allInnovations);

        // Featured item - choose the first one or a random one
        if (allInnovations.length > 0) {
            updateSpotlight(allInnovations[0]);
        }

        // Search Input Handling
        searchInput.addEventListener('input', () => {
            const activeCat = document.querySelector('.filter-pill.active') as HTMLButtonElement;
            filterInnovations(searchInput.value, activeCat?.dataset.category || 'all');
        });

        // Keybinding for search '/'
        window.addEventListener('keydown', (e) => {
            if (e.key === '/' && document.activeElement !== searchInput) {
                e.preventDefault();
                searchInput.focus();
            }
        });

    } catch (error) {
        console.error("AI Error:", error);
        if (loader) loader.style.display = 'none';
        if (errorMessage) {
            errorMessage.style.display = 'block';
            errorMessage.textContent = "We encountered a rift in the data stream. Please reload to try again.";
        }
    }
}

run();