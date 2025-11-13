import { initDashboard } from './dashboard.js';
import { initChapterAddPage } from './utils.js';
import { fetchAllListsAndRender } from './list_renderers.js';
import { loadDetailsPage } from './details_loader.js'; // Importujemy nowy loader

document.addEventListener('DOMContentLoaded', initPageRendering);

function initPageRendering() {
    const path = window.location.pathname;

    // Inicjalizacja logiki dodawania rozdziału (chapter_add.html)
    if (path.includes('chapter_add.html')) {
        initChapterAddPage();
        return;
    }
    
    // Inicjalizacja dashboardu (dashboard.html)
    if (path.includes('dashboard.html') || path === '/' || path.endsWith('/frontend/')) { // Dodano /frontend/ dla GitHuba
        initDashboard();
        return;
    }

    // Inicjalizacja stron pełnych list (chapters.html, characters.html, worlds.html)
    if (path.includes('chapters.html') || path.includes('characters.html') || path.includes('worlds.html')) {
        fetchAllListsAndRender();
        return;
    }

    // Inicjalizacja stron detali
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (id) {
        if (path.includes('chapter_details.html')) {
            loadDetailsPage(id, 'chapter');
        } else if (path.includes('character_details.html')) {
            loadDetailsPage(id, 'character');
        } else if (path.includes('world_details.html')) {
            loadDetailsPage(id, 'world');
        }
    } else if (path.includes('_details.html')) {
        // Obsługa braku ID, jeśli jesteśmy na stronie detali
        const type = path.split('/').pop().split('_')[0];
        const containerId = `${type}-details-content`;
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<p style="color: red;">BŁĄD: Brak wymaganego identyfikatora (ID) w adresie URL.</p>`;
        }
    }
}
