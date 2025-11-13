import { fetchDashboardData } from './utils.js';

export async function fetchAllListsAndRender() {
    try {
        const data = await fetchDashboardData();
        
        if (document.getElementById('full-chapter-list')) {
            renderFullChapterList(data.chapters.latestChapters);
        }
        
        if (document.getElementById('full-character-list')) {
            renderFullCharacterList(data.characters.list);
        }

        if (document.getElementById('full-world-list')) {
            renderFullWorldList(data.worlds.list);
        }
        
    } catch (error) {
        console.error('Błąd ładowania pełnych list:', error);
        document.querySelectorAll('.full-list').forEach(list => {
            list.innerHTML = `<p style="color: red;">Nie udało się załadować danych. ${error.message}</p>`;
        });
    }
}

function renderFullChapterList(chapters) {
    const listContainer = document.getElementById('full-chapter-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = ''; 
    if (chapters.length === 0) {
        listContainer.innerHTML = '<p class="loading-text">Brak zapisanych rozdziałów.</p>';
        return;
    }

    chapters.forEach(chapter => {
        const li = document.createElement('li');
        const date = new Date(chapter.VERSION_TIMESTAMP).toLocaleDateString('pl-PL');
        const charCount = (chapter.CONTENT?.length / 1000).toFixed(1) + 'k';
        const title = chapter.TITLE || chapter.CHAPTER_ID; 

        li.innerHTML = `
            <span><strong>${title}</strong> (Rozdział ${chapter.CHAPTER_ID.replace('CH-', '')})</span>
            <span>${date} / Znaki: ${charCount}</span>
            <a href="chapter_details.html?id=${chapter.CHAPTER_ID}" class="cta-btn">Detale</a>
        `;
        listContainer.appendChild(li);
    });
}

function renderFullCharacterList(characters) {
    const listContainer = document.getElementById('full-character-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = ''; 
    if (characters.length === 0) {
        listContainer.innerHTML = '<p class="loading-text">Brak utworzonych bohaterów.</p>';
        return;
    }

    characters.forEach(char => {
        const li = document.createElement('li');
        const charName = char.IMIE || 'N/A';
        const charId = char.ID; 
        
        li.innerHTML = `
            <span><strong>${charName}</strong></span>
            <span>Status: ${char.SZCZEGOLY?.status || 'N/A'}</span>
            <a href="character_details.html?id=${charId}" class="cta-btn">Detale</a>
        `;
        listContainer.appendChild(li);
    });
}

function renderFullWorldList(worlds) {
    const listContainer = document.getElementById('full-world-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = ''; 
    if (worlds.length === 0) {
        listContainer.innerHTML = '<p class="loading-text">Brak utworzonych węzłów.</p>';
        return;
    }

    worlds.forEach(world => {
        const li = document.createElement('li');
        const worldName = world.NAZWA || world.ID || 'N/A';
        const date = new Date(world.DATA_DODANIA).toLocaleDateString('pl-PL');
        const worldId = world.ID; 
        
        li.innerHTML = `
            <span><strong>${worldName}</strong></span>
            <span>Ostatni: ${date}</span>
            <a href="world_details.html?id=${worldId}" class="cta-btn">Detale</a>
        `;
        listContainer.appendChild(li);
    });
}
