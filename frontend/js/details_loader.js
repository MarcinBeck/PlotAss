import { fetchDashboardData, DASHBOARD_API_ENDPOINT } from './utils.js';

// === FUNKCJE API DLA DETALI ===

// Pobieranie detali rozdziału (przez skanowanie dashboardu)
async function fetchChapterDetails(chapterId) {
    const data = await fetchDashboardData();
    
    // Zbieramy najnowszą wersję rozdziału, która ma dane analityczne
    const chapter = data.chapters.latestChapters.find(c => c.CHAPTER_ID === chapterId);
    
    if (!chapter) {
        throw new Error(`Rozdział ${chapterId} nie znaleziony.`);
    }
    
    // Pobieramy dane o świecie, aby móc wyświetlić aktualny opis
    const worldNameKey = chapter.WORLD_NAME ? chapter.WORLD_NAME.toUpperCase() : null;
    let worldDetails = null;
    if (worldNameKey) {
         try {
             // Używamy dedykowanej funkcji do pobrania detali świata
             worldDetails = await fetchWorldDetails(worldNameKey); 
         } catch(e) {
             console.warn(`Nie udało się pobrać pełnych detali świata ${worldNameKey}.`, e);
         }
    }

    return { chapter, worldDetails };
}

// Pobieranie detali postaci (przez dedykowany endpoint)
async function fetchCharacterDetails(charId) {
    const response = await fetch(`${DASHBOARD_API_ENDPOINT}?charId=${charId}`, { method: 'GET' });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`BŁĄD API: ${data.error || 'Nieznany błąd.'}`);
    }
    return data;
}

// Pobieranie detali świata (przez dedykowany endpoint)
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

// Renderowanie detali rozdziału (Nowy Layout)
function renderChapterDetails(data) {
    const { chapter, worldDetails } = data;
    
    const chapterNumber = chapter.CHAPTER_ID.replace('CH-', '');
    document.getElementById('page-title').textContent = `${chapterNumber}: ${chapter.TITLE}`;
    document.getElementById('edit-link').href = `chapter_add.html?step=1&id=${chapter.CHAPTER_ID}`;
    
    // Data dodania
    document.getElementById('version-date').textContent = `Data dodania: ${new Date(chapter.VERSION_TIMESTAMP).toLocaleString('pl-PL')}`;
    
    // Główna sekcja
    document.getElementById('summary-text').textContent = chapter.SUMMARY || 'Brak szczegółowego streszczenia.';
    document.getElementById('raw-content-fragment').textContent = chapter.CONTENT?.substring(0, 500) + '...' || 'Brak treści.';

    // Boczna sekcja: Postacie
    const charListDetail = document.getElementById('character-list-detail');
    const characters = chapter.CHARACTERS || []; // Zakładamy, że to jest pełny lista obiektów postaci
    
    if (characters.length > 0) {
        charListDetail.innerHTML = '';
        document.querySelector('.sidebar-box:nth-child(1) h4').textContent = `Postacie (${characters.length})`;

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
    document.querySelector('.sidebar-box:nth-child(2) h4').textContent = `Sceny (${sceneCount})`;
    
    // Jeśli znasz JSON scen:
    // const scenes = chapter.SCENES_DATA || [];
    // if (scenes.length > 0) { ... }
    
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

// Renderowanie detali postaci (Ewolucja)
function renderCharacterDetails(data) {
    const { latestDetails, chaptersHistory } = data;
    document.getElementById('page-title').textContent = `Szczegóły Postaci: ${latestDetails.IMIE}`;
    const content = document.getElementById('character-details-content');
    
    let html = `
        <h3>Główne Dane Postaci</h3>
        <p><strong>Imię:</strong> ${latestDetails.IMIE}</p>
        <p><strong>Ostatni Status:</strong> ${latestDetails.SZCZEGOLY?.status || 'N/A'}</p>
        <p><strong>Typ:</strong> ${latestDetails.SZCZEGOLY?.typ || 'N/A'}</p>
        <p><strong>Data Ost. Zmiany:</strong> ${new Date(latestDetails.DATA_DODANIA).toLocaleString('pl-PL')}</p>
        
        <h3>Ewolucja i Historia w Rozdziałach</h3>
    `;
    
    chaptersHistory.sort((a, b) => {
        const numA = parseInt(a.chapterId.replace('CH-', ''));
        const numB = parseInt(b.chapterId.replace('CH-', ''));
        return numB - numA; 
    });

    chaptersHistory.forEach(chapter => {
        const chapterNumber = chapter.chapterId.replace('CH-', '');
        
        html += `<details class="analysis-section" open>
            <summary style="font-weight: bold; cursor: pointer; padding: 5px 0; font-size: 1.1em; color: #007bff;">
                ROZDZIAŁ ${chapterNumber} (${chapter.versions.length} Wersji)
            </summary>
            <ul class="version-list" style="list-style: none; padding-left: 0;">`;
        
        chapter.versions.sort((a, b) => new Date(b.versionTimestamp) - new Date(a.versionTimestamp)).forEach(version => {
            const formattedDate = new Date(version.versionTimestamp).toLocaleString('pl-PL');
            
            html += `
                <li>
                    <details style="margin-top: 10px; border-left: 3px solid #28a745; padding-left: 10px;">
                        <summary style="cursor: pointer;">
                            Wpis z: <strong>${formattedDate}</strong>
                        </summary>
                        <p style="margin-top: 5px; font-size: 0.9em;">
                            **Rola w Rozdziale:** ${version.rola_w_rozdziale} <br>
                            **Typ:** ${version.szczegoly?.typ || 'N/A'} <br>
                            **Status:** ${version.szczegoly?.status || 'N/A'}
                        </p>
                    </details>
                </li>
            `;
        });
        
        html += `</ul></details>`;
    });

    content.innerHTML = html;
}

// Renderowanie detali świata (Ewolucja)
function renderWorldDetails(data) {
    const { latestDetails, chaptersHistory } = data;
    document.getElementById('page-title').textContent = `Szczegóły Węzła: ${latestDetails.NAZWA}`;
    const content = document.getElementById('world-details-content');
    
    let html = `
        <h3>Główne Dane Węzła</h3>
        <p><strong>Nazwa:</strong> ${latestDetails.NAZWA}</p>
        <p><strong>Aktualny Opis:</strong> ${latestDetails.OPIS || 'Brak opisu.'}</p>
        <p><strong>Data Ost. Aktualizacji:</strong> ${new Date(latestDetails.DATA_DODANIA).toLocaleString('pl-PL')}</p>
        
        <h3>Historia Opisów Węzła w Rozdziałach</h3>
    `;
    
    chaptersHistory.sort((a, b) => {
        const numA = parseInt(a.chapterId.replace('CH-', ''));
        const numB = parseInt(b.chapterId.replace('CH-', ''));
        return numB - numA; 
    });

    chaptersHistory.forEach(chapter => {
        const chapterNumber = chapter.chapterId.replace('CH-', '');
        
        html += `<details class="analysis-section" open>
            <summary style="font-weight: bold; cursor: pointer; padding: 5px 0; font-size: 1.1em; color: #007bff;">
                ROZDZIAŁ ${chapterNumber} (${chapter.versions.length} Wersji)
            </summary>
            <ul class="version-list" style="list-style: none; padding-left: 0;">`;
        
        chapter.versions.sort((a, b) => new Date(b.versionTimestamp) - new Date(a.versionTimestamp)).forEach(version => {
            const formattedDate = new Date(version.versionTimestamp).toLocaleString('pl-PL');
            
            html += `
                <li>
                    <details style="margin-top: 10px; border-left: 3px solid #28a745; padding-left: 10px;">
                        <summary style="cursor: pointer;">
                            Wpis z: <strong>${formattedDate}</strong>
                        </summary>
                        <p style="margin-top: 5px; font-size: 0.9em;">
                            **Opis:** ${version.opis}
                        </p>
                    </details>
                </li>
            `;
        });
        
        html += `</ul></details>`;
    });

    content.innerHTML = html;
}

// === FUNKCJA GŁÓWNA LOADERA ===
export async function loadDetailsPage(id, type) {
    document.getElementById('page-title').textContent = `Ładowanie szczegółów ${type}...`;
    const contentContainerId = `${type}-details-content`;

    try {
        if (type === 'chapter') {
            const details = await fetchChapterDetails(id);
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
        renderError(contentContainerId, error.message);
    }
}
