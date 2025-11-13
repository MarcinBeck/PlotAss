import { initDashboard } from './dashboard.js';
import { initChapterAddPage } from './utils.js';
import { fetchAllListsAndRender } from './list_renderers.js';

document.addEventListener('DOMContentLoaded', initPageRendering);

function initPageRendering() {
    const path = window.location.pathname;

    // Inicjalizacja logiki dodawania rozdziału (chapter_add.html)
    if (path.includes('chapter_add.html')) {
        initChapterAddPage();
        return;
    }
    
    // Inicjalizacja dashboardu (dashboard.html)
    if (path.includes('dashboard.html') || path === '/' || path === '/index.html') {
        initDashboard();
        return;
    }

    // Inicjalizacja stron pełnych list (chapters.html, characters.html, worlds.html)
    if (path.includes('chapters.html') || path.includes('characters.html') || path.includes('worlds.html')) {
        fetchAllListsAndRender();
        return;
    }

    // Dodatkowa logika dla stron detali
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (path.includes('character_details.html') && id) {
        console.log(`Ładowanie detali postaci ID: ${id}`);
    } else if (path.includes('world_details.html') && id) {
        console.log(`Ładowanie detali świata ID: ${id}`);
    } else if (path.includes('chapter_details.html') && id) {
        console.log(`Ładowanie detali rozdziału ID: ${id}`);
    }
}
