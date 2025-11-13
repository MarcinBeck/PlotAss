// Plik: index.mjs (ChapterManager - LOGIKA GRANULARNEGO ZAPISU SEKCJI)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

// Klienci AWS
const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);

// Stałe 
const CHAPTERS_TABLE = 'LLM_Chapters_V2'; 
const PLOT_EVENTS_TABLE = 'LLM_PlotEvents'; 
const CHARACTERS_TABLE = 'LLM_Characters'; 
const WORLDS_TABLE = 'LLM_Worlds'; 

const CHAPTERS_ID = 'CHAPTER_ID'; 
const VERSION_ID = 'VERSION_TIMESTAMP'; 


// =======================================================
// FUNKCJA POMOCNICZA: CZYŚCI ID (USUNIĘTO TEMP_)
// =======================================================

// Tworzy stabilny klucz Partycjonujący z imienia, bez prefiksu TEMP_
const cleanCharId = (name) => {
    if (typeof name !== 'string' || name.length === 0) return null;
    
    // Usuwamy znaki inne niż litery, cyfry i polskie znaki
    const safeName = name.replace(/[^A-Za-z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, ''); 
    
    // Jeśli po usunięciu zostało puste imię lub jest za krótkie na sensowny klucz
    if (safeName.length < 2) return null; 
    
    // Używamy bezpośrednio nazwy (wielkie litery) jako klucza partycjonującego
    return safeName.toUpperCase(); 
};


// =======================================================
// KROK 1: Zapis Surowego Rozdziału (Raw Save)
// ... (logika bez zmian) ...
// =======================================================

const saveRawChapter = async (dbClient, chapterId, title, content) => {
    const versionTimestamp = new Date().toISOString(); 
    
    const chapterItem = {
        [CHAPTERS_ID]: chapterId, 
        [VERSION_ID]: versionTimestamp, 
        TITLE: title,
        CONTENT: content, 
        STATUS: 'RAW' 
    };
    
    await dbClient.send(new PutCommand({ TableName: CHAPTERS_TABLE, Item: chapterItem }));

    return { 
        message: `Rozdział ${chapterId} zapisany jako RAW. Przejdź do analizy.`, 
        CHAPTER_ID: chapterId,
        VERSION_TIMESTAMP: versionTimestamp,
        TITLE: title
    };
};

// =======================================================
// KROK 3: Granularne Zapisy Sekcji
// =======================================================

const processSectionUpdate = async (dbClient, chapterId, chapterNumber, currentTimestamp, rawTimestamp, sectionData, sectionType) => {
    
    // 0. Pobranie RAW CONTENT (potrzebne do finalnego zapisu rozdziału)
    const { Item: rawChapter } = await dbClient.send(new GetCommand({
        TableName: CHAPTERS_TABLE,
        Key: { 
            [CHAPTERS_ID]: chapterId, 
            [VERSION_ID]: rawTimestamp 
        }
    }));
    
    if (!rawChapter) {
        throw new Error(`Nie znaleziono surowej wersji rozdziału: ${chapterId} z datą ${rawTimestamp}`);
    }

    switch (sectionType) {
        case 'CHARACTERS':
            const identifiedCharactersPromises = (sectionData.postacie || [])
                .map(obj => {
                    const charId = cleanCharId(obj.imie);
                    
                    if (!charId) { 
                        console.error(`BŁĄD DANYCH: Pominięto postać z powodu nieprawidłowego klucza. Nazwa: "${obj.imie}"`);
                        return null; 
                    }
                    
                    const characterEvolutionEntry = {
                        ID: charId, // Partition Key (bez TEMP_)
                        SOURCE_VERSION: `${chapterId}#${currentTimestamp}`, // Sort Key
                        IMIE: obj.imie,
                        ROZDZIAL_NUMER: chapterNumber,
                        SOURCE_CHAPTER_ID: chapterId,
                        ROLA_W_ROZDZIALE: obj.rola_w_rozdziale,
                        SZCZEGOLY: obj, 
                        DATA_DODANIA: currentTimestamp
                    };
                    return dbClient.send(new PutCommand({ TableName: CHARACTERS_TABLE, Item: characterEvolutionEntry }));
                })
                .filter(p => p !== null); 

            await Promise.all(identifiedCharactersPromises);
            console.log(`Zapisano ${identifiedCharactersPromises.length} rekordów postaci.`);
            break;

        case 'WORLD':
            const worldData = sectionData.swiat;
            if (worldData && worldData.nazwa) {
                const worldEntry = {
                    ID: worldData.nazwa, 
                    SOURCE_VERSION: `${chapterId}#${currentTimestamp}`, 
                    ROZDZIAL_NUMER: chapterNumber,
                    OPIS: worldData.opis,
                    SOURCE_CHAPTER_ID: chapterId,
                    DATA_DODANIA: currentTimestamp
                };
                await dbClient.send(new PutCommand({ TableName: WORLDS_TABLE, Item: worldEntry }));
                console.log(`Zapisano opis świata: ${worldData.nazwa}.`);
            } else {
                 throw new Error('Brak wymaganych danych w sekcji ŚWIAT.');
            }
            break;

        case 'SCENES':
            const plotEventsPromises = (sectionData.sceny || []).map(scene => {
                const sceneId = `${chapterId}-${scene.numer}`;
                const plotEvent = {
                    ID_ZDARZENIA: sceneId, 
                    SOURCE_CHAPTER_ID: chapterId,
                    SOURCE_VERSION: currentTimestamp,
                    ROZDZIAL_NUMER: chapterNumber,
                    TYTUL_SCENY: scene.tytul,
                    OPIS_SCENY: scene.opis,
                    DATA_DODANIA: currentTimestamp
                };
                return dbClient.send(new PutCommand({ TableName: PLOT_EVENTS_TABLE, Item: plotEvent }));
            });
            await Promise.all(plotEventsPromises);
            console.log(`Zapisano ${plotEventsPromises.length} scen/zdarzeń.`);
            break;
            
        case 'SUMMARY':
            // Finalne uaktualnienie rozdziału po pomyślnych zapisach sekcji (dla dashboardu)
            if (!sectionData.summary || !sectionData.title) {
                 throw new Error('Brak wymaganych danych w sekcji SUMMARY (summary/title).');
            }
            
            const chapterItem = {
                [CHAPTERS_ID]: chapterId, 
                [VERSION_ID]: currentTimestamp, 
                TITLE: sectionData.title,
                CONTENT: rawChapter.CONTENT, 
                STATUS: 'ANALYZED',
                SUMMARY: sectionData.summary.substring(0, 500),
                DANE_STATYSTYCZNE: sectionData.stats,
                SCENES_COUNT: sectionData.sceny_count || 0,
                WORLD_NAME: sectionData.world_name || 'N/A',
                CHARACTERS_COUNT: sectionData.characters_count || 0,
                CHARACTERS: sectionData.characters_list // Lista imion
            };
            await dbClient.send(new PutCommand({ TableName: CHAPTERS_TABLE, Item: chapterItem }));
            console.log(`Zaktualizowano LLM_Chapters_V2 (SUMMARY).`);
            break;
            
        default:
            throw new Error(`Nieznany typ sekcji: ${sectionType}`);
    }

    return { status: 'SAVED', sectionType, message: `Sekcja ${sectionType} zapisana pomyślnie.` };
};


// =======================================================
// HANDLER GŁÓWNY (Dwa kroki)
// ... (logika bez zmian) ...
// =======================================================

export const handler = async (event) => {
    
    // Usunięto Access-Control-Allow-* i pozostawiono tylko Content-Type
    const headers = { 
        "Content-Type": "application/json"
    };
    
    if (event.httpMethod === 'OPTIONS') { return { statusCode: 200 }; }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body || '{}');
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Niepoprawny format JSON w ciele zapytania.' }) };
    }

    try {
        // --- KROK 2/3: Auto Save Logic (Combined Save) ---
        if (requestBody.fullAutoSaveData) {
            const { rawVersionTimestamp, numer_rozdzialu, ...fullJsonData } = requestBody.fullAutoSaveData;
            const chapterId = `CH-${numer_rozdzialu}`;
            const currentTimestamp = new Date().toISOString(); 
            
            // Logika auto-zapisu musi przekazać wszystkie dane do finalnego SUMMARY
            const analysisResult = await performAllSectionSaves(db, chapterId, numer_rozdzialu, currentTimestamp, rawVersionTimestamp, fullJsonData);
            
            // Poprawiamy finalny zapis SUMMARY, aby upewnić się, że LLM_Chapters_V2 ma pełne statystyki
            if (analysisResult.results.SUMMARY.success) {
                 const summaryData = {
                    summary: fullJsonData.streszczenie_szczegolowe, 
                    title: fullJsonData.tytul_rozdzialu,
                    stats: fullJsonData.dane_statystyczne,
                    sceny_count: analysisResult.results.SCENES?.count || 0,
                    world_name: analysisResult.results.WORLD?.name || 'N/A',
                    characters_count: analysisResult.results.CHARACTERS?.count || 0,
                    characters_list: fullJsonData.postacie.map(p => p.imie)
                };
                // Ponownie uruchamiamy zapis SUMMARY z pełnymi danymi
                await processSectionUpdate(db, chapterId, numer_rozdzialu, currentTimestamp, rawVersionTimestamp, summaryData, 'SUMMARY');
            }
            
            // Ponownie pobieramy wyniki, aby uwzględnić finalny zapis SUMMARY
            const finalResults = await performAllSectionSaves(db, chapterId, numer_rozdzialu, currentTimestamp, rawVersionTimestamp, fullJsonData);

            return { statusCode: 200, headers, body: JSON.stringify(finalResults) };
        }
        
        // --- KROK 1: Raw Save Logic ---
        const { chapterNumber, title, content } = requestBody;
        const chapterId = `CH-${chapterNumber}`;

        if (!chapterNumber || !title || !content) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Wymagane pola KROKU 1: chapterNumber, title, content.' }) };
        }
        
        const rawSaveResult = await saveRawChapter(db, chapterId, title, content);
        
        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ 
                ...rawSaveResult,
                STATUS: 'RAW_SAVED_READY_FOR_ANALYSIS' 
            }) 
        };

    } catch (error) {
        console.error("FATALNY BŁĄD W ChapterManager:", error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: `BŁĄD BACKENDU: ${error.message}` }) 
        };
    }
};
