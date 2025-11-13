import { fetchDashboardData, DASHBOARD_API_ENDPOINT } from './utils.js';

// === FUNKCJE API DLA DETALI ===

// Pobieranie detali rozdziału (przez skanowanie dashboardu)
async function fetchChapterDetails(chapterId) {
    const data = await fetchDashboardData();
    
    // Zabezpieczenie przed błędem: Sprawdzamy, czy struktura istnieje
    const latestChapters = data.chapters?.latestChapters;

    if (!latestChapters || latestChapters.length === 0) {
        throw new Error("Brak danych o rozdziałach lub niepoprawna struktura zwrócona przez API.");
    }

    // Zbieramy najnowszą wersję rozdziału, która ma dane analityczne
    const chapter = latestChapters.find(c => c.CHAPTER_ID === chapterId);
    
    if (!chapter) {
        throw new Error(`Rozdział ${chapterId} nie znaleziony w bazie danych.`);
    }
    
    // Pobieramy dane o świecie, aby móc wyświetlić aktualny opis
    const worldNameKey = chapter.WORLD_NAME ? chapter.WORLD_NAME.toUpperCase() : null;
    let worldDetails = null;
    if (worldNameKey) {
         try {
             worldDetails = await fetchWorldDetails(worldNameKey); 
         } catch(e) {
             console.warn(`Nie udało się pobrać pełnych detali świata ${worldNameKey}.`, e);
         }
    }

    return { chapter, worldDetails };
}

// ... (pozostałe funkcje API: fetchCharacterDetails, fetchWorldDetails) ...

async function fetchCharacterDetails(charId) {
    const response = await fetch(`${DASHBOARD_API_ENDPOINT}?charId=${charId}`, { method: 'GET' });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`BŁĄD API: ${data.error || 'Nieznany błąd.'}`);
    }
    return data;
}

async function fetchWorldDetails(worldId) {
    const response = await fetch(`${DASHBOARD_API_ENDPOINT}?worldId=${worldId}`, { method: 'GET' });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`BŁĄD API: ${data.error || 'Nieznany błąd.'}`);
    }
    return data;
}


// === FUNKCJE RENDEROWANIA ===

function renderError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<p style="color: red;">BŁĄD: ${message}</p>`;
    }
}

// Renderowanie detali rozdziału (Nowy Layout - Usunięto treść RAW)
function renderChapterDetails(data) {
    const { chapter, worldDetails } = data;
    
    const chapterNumber = chapter.CHAPTER_ID.replace('CH-', '');
    document.getElementById('page-title').textContent = `${chapterNumber}: ${chapter.TITLE}`;
    document.getElementById('edit-link').href = `chapter_add.html?step=1&id=${chapter.CHAPTER_ID}`;
    
    // Data dodania
    document.getElementById('version-date').textContent = `Data dodania: ${new Date(chapter.VERSION_TIMESTAMP).toLocaleString('pl-PL')}`;
    
    // Główna sekcja - TYLKO streszczenie
    document.getElementById('summary-text').textContent = chapter.SUMMARY || 'Brak szczegółowego streszczenia.';

    // Boczna sekcja: Postacie
    const charListDetail = document.getElementById('character-list-detail');
    const characters = chapter.CHARACTERS || [];
    
    if (characters.length > 0) {
        charListDetail.innerHTML = '';
        document.querySelector('#sidebar-analysis .sidebar-box:nth-child(1) h4').textContent = `Postacie (${characters.length})`;

        characters.forEach(char => {
             const charId = (char.imie || 'N/A').toUpperCase();

             charListDetail.innerHTML += `
                <div class="char-box">
                    <strong>${char.imie || 'Nieznane Imię'}</strong>
                    Rola: ${char.rola_w_rozdziale || 'N/A'} <br>
                    Status: ${char.status || 'N/A'}
                    <a href="character_details.html?id=${charId}">Zobacz Detale Postaci &rarr;</a>
                </div>
             `;
        });
    } else {
         charListDetail.innerHTML = '<p>Brak zidentyfikowanych postaci.</p>';
    }

    // Boczna sekcja: Sceny
    const sceneListDetail = document.getElementById('scene-list-detail');
    const sceneCount = chapter.SCENES_COUNT || 0;
    document.querySelector('#sidebar-analysis .sidebar-box:nth-child(2) h4').textContent = `Sceny (${sceneCount})`;
    
    if (sceneCount > 0) {
        sceneListDetail.innerHTML = `
            <p><strong>${sceneCount}</strong> zidentyfikowanych scen. </p>
            <p>Pełne detale sceny wymagają dedykowanego odczytu z tabeli LLM_PlotEvents.</p>
            <p><a href="scenes.html">Przejdź do listy scen &rarr;</a></p>
        `;
    } else {
         sceneListDetail.innerHTML = '<p>Brak zidentyfikowanych scen.</p>';
    }


    // Boczna sekcja: Świat
    const worldInfoDetail = document.getElementById('world-info-detail');
    const currentWorld = worldDetails?.latestDetails || {NAZWA: chapter.WORLD_NAME || 'N/A', OPIS: 'Brak detali w bazie.'};

    worldInfoDetail.innerHTML = `
        <p><strong>Węzeł:</strong> ${currentWorld.NAZWA}</p>
        <p><strong>Opis:</strong> ${currentWorld.OPIS?.substring(0, 100) + '...' || 'Brak opisu.'}</p>
        <a href="world_details.html?id=${currentWorld.ID || chapter.WORLD_NAME || 'N/A'}">Zobacz Historię Węzła &rarr;</a>
    `;
}

// ... (pozostały kod renderowania postaci i świata bez zmian) ...
function renderCharacterDetails(data) { /* ... */ }
function renderWorldDetails(data) { /* ... */ }

// === FUNKCJA GŁÓWNA LOADERA ===
export async function loadDetailsPage(id, type) {
    document.getElementById('page-title').textContent = `Ładowanie szczegółów ${type}...`;
    const contentContainerId = `${type}-details-content`;

    try {
        if (type === 'chapter') {
            const details = await fetchChapterDetails(id);
            // Renderowanie rozdziału używa nowej struktury, więc nie potrzebuje kontenera "chapter-details-content"
            renderChapterDetails(details);
        } else if (type === 'character') {
            const details = await fetchCharacterDetails(id);
            renderCharacterDetails(details);
        } else if (type === 'world') {
            const details = await fetchWorldDetails(id);
            renderWorldDetails(details);
        } else {
             renderError(contentContainerId, 'Nieznany typ detali.');
        }
    } catch (error) {
        console.error(`Błąd ładowania detali ${type}:`, error);
        // Błąd w rozdziale wyświetlamy w głównym gridzie
        if (type === 'chapter') {
             document.getElementById('chapter-details-grid').innerHTML = `<p style="color: red; padding: 20px;">BŁĄD: ${error.message}</p>`;
        } else {
             renderError(contentContainerId, error.message);
        }
    }
}
