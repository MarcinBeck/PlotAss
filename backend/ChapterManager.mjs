// Plik: index.mjs (ChapterManager - Finalna Wersja - Uproszczony schemat postaci i świata)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

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
// FUNKCJA POMOCNICZA: CZYŚCI ID (Partition Key)
// =======================================================

const cleanCharId = (name) => {
    if (typeof name !== 'string' || name.length === 0) return null;
    
    const safeName = name.replace(/[^A-Za-z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, ''); 
    
    if (safeName.length < 2) return null; 
    return safeName.toUpperCase(); 
};


// =======================================================
// KROK 1: Zapis Surowego Rozdziału (Raw Save)
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
    
    // 0. Pobranie RAW CONTENT
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
            
            const validUpdatePromises = (sectionData.postacie || [])
                .map((obj) => {
                    const charId = cleanCharId(obj.imie);
                    
                    if (!charId) { 
                        console.error(`BŁĄD DANYCH: Pominięto postać z powodu nieprawidłowego klucza. Nazwa: "${obj.imie}"`);
                        return null; 
                    }
                    
                    return (async () => {
                        
                        // --- WSPÓLNE DANE DLA HISTORII ---
                        const historyEntry = {
                            DATA_WPROWADZENIA: currentTimestamp,
                            ROLA_W_ROZDZIALE: obj.rola_w_rozdziale,
                            STATUS: obj.status, 
                            TYP: obj.typ,
                            SOURCE_CHAPTER_ID: chapterId
                        };
                        
                        const chapterKey = chapterNumber.toString();
                        
                        // 1. SPRAWDŹ ISTNIENIE REKORDU
                        const { Item: existingItem } = await dbClient.send(new GetCommand({ TableName: CHARACTERS_TABLE, Key: { ID: charId } }));
                        
                        if (!existingItem) {
                            // CASE 1: NOWY REKORD -> Użyj PutCommand
                            const initialItem = {
                                ID: charId,
                                IMIE: obj.imie,
                                DATA_DODANIA: currentTimestamp,
                                SZCZEGOLY: { status: obj.status, typ: obj.typ },
                                HISTORIA_ROZDZIALOW: { [chapterKey]: [historyEntry] } // Inicjujemy Mapę z pierwszą Listą
                            };
                            await dbClient.send(new PutCommand({ TableName: CHARACTERS_TABLE, Item: initialItem }));
                        
                        } else {
                            // CASE 2: ISTNIEJĄCY REKORD -> Użyj UpdateCommand
                            const updateParams = {
                                TableName: CHARACTERS_TABLE,
                                Key: { ID: charId },
                                UpdateExpression: 'SET IMIE = :imie, DATA_DODANIA = :data, SZCZEGOLY = :szczegoly, #historyMap.#chapNum = list_append(if_not_exists(#historyMap.#chapNum, :emptyList), :newEntry)',
                                ExpressionAttributeNames: {
                                    '#historyMap': 'HISTORIA_ROZDZIALOW',
                                    '#chapNum': chapterKey
                                },
                                ExpressionAttributeValues: {
                                    ':imie': obj.imie,
                                    ':data': currentTimestamp,
                                    ':szczegoly': { status: obj.status, typ: obj.typ },
                                    ':newEntry': [historyEntry],
                                    ':emptyList': []
                                }
                            };
                            await dbClient.send(new UpdateCommand(updateParams));
                        }

                        return charId; 
                    })().catch(e => {
                         console.error(`BŁĄD ZAPISU POSTACI ${charId}: ${e.message}`, e);
                         throw e;
                    });
                })
                .filter(p => p !== null); 

            await Promise.all(validUpdatePromises);

            console.log(`Zapisano/Zaktualizowano ${validUpdatePromises.length} rekordów postaci.`);
            return { status: 'SAVED', sectionType, count: validUpdatePromises.length };

        case 'WORLD':
            const worldData = sectionData.swiat;
            if (worldData && worldData.nazwa) {
                const worldName = worldData.nazwa.toUpperCase(); // Klucz partycjonujący
                
                // --- WPIS HISTORYCZNY DLA ŚWIATA ---
                const worldHistoryEntry = {
                    DATA_WPROWADZENIA: currentTimestamp,
                    ROZDZIAL_NUMER: chapterNumber,
                    SOURCE_CHAPTER_ID: chapterId,
                    OPIS: worldData.opis // Pełny opis świata
                };

                // 1. SPRAWDŹ ISTNIENIE REKORDU
                const { Item: existingItem } = await dbClient.send(new GetCommand({ TableName: WORLDS_TABLE, Key: { ID: worldName } }));
                
                if (!existingItem) {
                    // CASE 1: NOWY REKORD ŚWIATA
                    const initialItem = {
                        ID: worldName,
                        NAZWA: worldData.nazwa,
                        DATA_DODANIA: currentTimestamp,
                        OPIS: worldData.opis, // Najnowszy opis na najwyższym poziomie
                        HISTORIA_ROZDZIALOW: [worldHistoryEntry] // Inicjujemy Listę Historii
                    };
                    await dbClient.send(new PutCommand({ TableName: WORLDS_TABLE, Item: initialItem }));

                } else {
                    // CASE 2: ISTNIEJĄCY REKORD ŚWIATA
                    const updateParams = {
                        TableName: WORLDS_TABLE,
                        Key: { ID: worldName },
                        // Aktualizujemy główny opis, datę i dodajemy do listy historii
                        UpdateExpression: 'SET OPIS = :opis, DATA_DODANIA = :data, NAZWA = :nazwa, HISTORIA_ROZDZIALOW = list_append(if_not_exists(HISTORIA_ROZDZIALOW, :emptyList), :newEntry)',
                        ExpressionAttributeValues: {
                            ':opis': worldData.opis,
                            ':data': currentTimestamp,
                            ':nazwa': worldData.nazwa,
                            ':newEntry': [worldHistoryEntry],
                            ':emptyList': []
                        }
                    };
                    await dbClient.send(new UpdateCommand(updateParams));
                }
                
                console.log(`Zapisano/Zaktualizowano opis świata: ${worldData.nazwa}.`);
                return { status: 'SAVED', sectionType, name: worldData.nazwa };
            } else {
                 throw new Error('Brak wymaganych danych w sekcji ŚWIAT.');
            }

        case 'SCENES':
            // ... (Logika bez zmian) ...
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
            return { status: 'SAVED', sectionType, count: plotEventsPromises.length };
            
        case 'SUMMARY':
            // ... (Logika bez zmian) ...
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
                CHARACTERS: sectionData.characters_list
            };
            await dbClient.send(new PutCommand({ TableName: CHAPTERS_TABLE, Item: chapterItem }));
            console.log(`Zaktualizowano LLM_Chapters_V2 (SUMMARY).`);
            return { status: 'SAVED', sectionType };
            
        default:
            throw new Error(`Nieznany typ sekcji: ${sectionType}`);
    }
};

/**
 * ... (performAllSectionSaves i handler bez zmian w logice) ...
 */
const performAllSectionSaves = async (dbClient, chapterId, chapterNumber, currentTimestamp, rawVersionTimestamp, fullJsonData) => {
    
    const results = {};
    
    const sections = [
        { type: 'CHARACTERS', data: fullJsonData },
        { type: 'WORLD', data: fullJsonData },
        { type: 'SCENES', data: fullJsonData }
    ];
    
    let charactersCount = 0;
    let worldName = 'N/A';
    let scenesCount = 0;

    // 1. Zapis sekcji granularnych
    for (const section of sections) {
        try {
            const result = await processSectionUpdate(dbClient, chapterId, chapterNumber, currentTimestamp, rawVersionTimestamp, section.data, section.type);
            results[section.type] = { success: true, result: result };
            
            // Zbieranie statystyk
            if (section.type === 'CHARACTERS') {
                charactersCount = result.count;
            } else if (section.type === 'WORLD') {
                worldName = result.name;
            } else if (section.type === 'SCENES') {
                scenesCount = result.count;
            }
        } catch (error) {
            console.error(`Błąd zapisu sekcji ${section.type}:`, error);
            results[section.type] = { success: false, error: error.message };
        }
    }
    
    // 2. Finalny zapis SUMMARY
    const summaryData = {
        summary: fullJsonData.streszczenie_szczegolowe, 
        title: fullJsonData.tytul_rozdzialu,
        stats: fullJsonData.dane_statystyczne,
        sceny_count: scenesCount,
        world_name: worldName,
        characters_count: charactersCount,
        characters_list: fullJsonData.postacie ? fullJsonData.postacie.map(p => p.imie) : []
    };
    
    try {
        await processSectionUpdate(dbClient, chapterId, chapterNumber, currentTimestamp, rawVersionTimestamp, summaryData, 'SUMMARY');
        results['SUMMARY'] = { success: true, result: { status: 'SAVED', sectionType: 'SUMMARY' } };
    } catch (error) {
        console.error('Błąd finalnego zapisu SUMMARY:', error);
        results['SUMMARY'] = { success: false, error: error.message };
    }
    
    return { 
        STATUS: 'AUTO_SAVE_COMPLETED',
        results: results
    };
};


// =======================================================
// HANDLER GŁÓWNY (Dwa kroki)
// =======================================================

export const handler = async (event) => {
    
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
            
            const parsedChapterNumber = parseInt(numer_rozdzialu);
            if (isNaN(parsedChapterNumber)) {
                 throw new Error('Numer rozdziału musi być poprawną liczbą.');
            }
            
            const chapterId = `CH-${parsedChapterNumber}`;
            const currentTimestamp = new Date().toISOString(); 
            
            const finalResults = await performAllSectionSaves(db, chapterId, parsedChapterNumber, currentTimestamp, rawVersionTimestamp, fullJsonData);

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
