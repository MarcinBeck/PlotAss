import { fetchDashboardData } from './utils.js';

// === FUNKCJE API DLA DETALI ===
async function fetchChapterDetails(chapterId) {
    // Uwaga: Detale Rozdziału nie mają dedykowanego endpointu GET, 
    // więc na razie pobierzemy wszystkie, a następnie znajdziemy ten konkretny rozdział.
    // W przyszłości zalecane jest dodanie dedykowanego endpointu GET /ChapterManager?id=...
    const data = await fetchDashboardData();
    const chapter = data.chapters.lastUpdates.find(c => c.CHAPTER_ID === chapterId) || 
                    data.chapters.latestChapters.find(c => c.CHAPTER_ID === chapterId);
    
    if (!chapter) {
        throw new Error(`Rozdział ${chapterId} nie znaleziony.`);
    }
    return chapter;
}

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

function renderChapterDetails(details) {
    document.getElementById('page-title').textContent = `Szczegóły Rozdziału: ${details.TITLE}`;
    const content = document.getElementById('chapter-details-content');
    
    // Proste renderowanie podstawowych detali rozdziału
    content.innerHTML = `
        <h3>Informacje Podstawowe</h3>
        <p><strong>ID Wersji:</strong> <code>${details.VERSION_TIMESTAMP}</code></p>
        <p><strong>Status:</strong> <span class="status-tag status-new">${details.STATUS || 'ANALYZED'}</span></p>
        <p><strong>Liczba znaków:</strong> ${(details.CONTENT?.length / 1000).toFixed(1)}k</p>
        <p><strong>Streszczenie:</strong> ${details.SUMMARY || 'Brak podsumowania.'}</p>
        
        <h3>Treść Rozdziału (Fragment)</h3>
        <pre style="white-space: pre-wrap; background: #f0f0f0; padding: 15px; border-radius: 4px;">${details.CONTENT?.substring(0, 500) + '...' || 'Brak treści.'}</pre>
    `;
}

function renderCharacterDetails(data) {
    const { latestDetails, chaptersHistory } = data;
    document.getElementById('page-title').textContent = `Szczegóły Postaci: ${latestDetails.IMIE}`;
    const content = document.getElementById('character-details-content');
    
    // Renderowanie głowy rekordu
    let html = `
        <h3>Główne Dane Postaci</h3>
        <p><strong>Imię:</strong> ${latestDetails.IMIE}</p>
        <p><strong>Ostatni Status:</strong> ${latestDetails.SZCZEGOLY?.status || 'N/A'}</p>
        <p><strong>Typ:</strong> ${latestDetails.SZCZEGOLY?.typ || 'N/A'}</p>
        <p><strong>Data Stworzenia:</strong> ${new Date(latestDetails.DATA_DODANIA).toLocaleString('pl-PL')}</p>
        
        <h3>Ewolucja i Historia w Rozdziałach</h3>
    `;
    
    // Sortujemy rozdziały malejąco (najnowszy numer rozdziału na górze)
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
        
        // Sortujemy wersje w ramach Rozdziału (Data i Detale) - malejąco
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
    
    // Sortujemy rozdziały malejąco
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
        
        // Sortujemy wersje w ramach Rozdziału (Data i Detale) - malejąco
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
             renderError(`${type}-details-content`, 'Nieznany typ detali.');
        }
    } catch (error) {
        console.error(`Błąd ładowania detali ${type}:`, error);
        renderError(`${type}-details-content`, error.message);
    }
}
