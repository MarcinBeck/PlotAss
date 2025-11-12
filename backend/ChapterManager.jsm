// Plik: index.mjs (ChapterManager - FINALNA WERSJA STABILNA Z REGEX PARSOWANIEM)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

// Klienci AWS
const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);

// Stałe 
const CHAPTERS_TABLE = 'LLM_Chapters_V2'; 
const PLOT_EVENTS_TABLE = 'LLM_PlotEvents'; 
const CHARACTERS_TABLE = 'LLM_Characters'; 

const CHAPTERS_ID = 'CHAPTER_ID'; 
const VERSION_ID = 'VERSION_TIMESTAMP'; 
const ID_ZDARZENIA = 'ID_ZDARZENIA'; 

// === KONFIGURACJA GEMINI BEZ SDK (Fetch API) ===
const GEMINI_API_KEY = "AIzaSyCxPF48VyaW8AKmcZuMifuOAFlDFteHfqg"; 
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"; 

const headers = { 
    "Content-Type": "application/json"
};

// =======================================================
// FUNKCJA POMOCNICZA: CZYŚCI ID
// =======================================================

// Tworzy stabilny, tymczasowy ID z imienia
const cleanCharId = (name) => {
    if (typeof name !== 'string' || name.length === 0) return null;
    const safeName = name.replace(/[^A-Za-z0-9]/g, ''); 
    return `TEMP_${safeName.toUpperCase()}`;
};

// =======================================================
// FUNKCJA POMOCNICZA: Sprawdza i tworzy postać bazową
// =======================================================

const checkOrCreateCharacter = async (dbClient, charId, charName) => {
    // 1. Sprawdź, czy postać istnieje
    const { Item } = await dbClient.send(new GetCommand({
        TableName: CHARACTERS_TABLE,
        Key: { ID: charId }
    }));

    if (Item) {
        return false; // Postać już istnieje
    }

    // 2. Jeśli nie, stwórz bazowy rekord
    const newCharacter = {
        ID: charId,
        IMIE: charName, 
        A_DANE_OGOLNE: {
            ROLA: "Nowa postać (dynamicznie dodana)",
            WEZEL_ID: "Nieznany"
        },
        C_3_HISTORIA_ZDARZEN: [] 
    };

    await dbClient.send(new PutCommand({
        TableName: CHARACTERS_TABLE,
        Item: newCharacter
    }));
    
    console.log(`[INIT] Stworzono nowy rekord postaci: ${charId}`);
    return true; 
};


// =======================================================
// LOGIKA ANALIZY (Używa Fetch do Gemini)
// =======================================================

const runAnalysisLogic = async (dbClient, chapterData) => {
    
    const { CHAPTER_ID, VERSION_TIMESTAMP, CONTENT } = chapterData;

    // NOWY PROMPT: Żądamy zwykłego tekstu z listą na końcu
    const prompt = `Jesteś ekspertem. Wykonaj analizę. 
    1. Zidentyfikuj WSZYSTKIE unikalne postacie (tylko imiona/pseudonimy) aktywne w tym rozdziale. Zwróć JEDYNIE listę ich imion w ostatniej linii odpowiedzi, ODDZIELAJĄC JE TYLKO PRZECINKAMI. 
    2. Stwórz krótkie streszczenie (max 300 znaków). 
    
    Treść rozdziału: ${CONTENT.substring(0, 1000)}...`;

    const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "text/plain" }
    };
    
    let analysisText;
    let attempt = 0;
    const MAX_RETRIES = 5; 
    
    while (attempt < MAX_RETRIES) {
        attempt++;
        
        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                if ((response.status === 503 || response.status === 429) && attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
                    continue; 
                }
                throw new Error(`Błąd API: ${response.status} - ${errorText.substring(0, 80)}`);
            }

            const geminiResponse = await response.json();
            analysisText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!analysisText) {
                throw new Error("Błąd: Gemini nie zwróciło treści analitycznej.");
            }
            
            break; 

        } catch (e) {
            if (attempt === MAX_RETRIES) {
                throw new Error(`Osiągnięto limit ponowień. Błąd: ${e.message}`);
            }
            const delay = 1000 * Math.pow(2, attempt);
            console.warn(`Błąd sieciowy: ${e.message}. Ponawiam za ${delay}ms.`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }


    // --- KLUCZOWE PARSOWANIE TEKSTU (REGEX/SPLIT) ---
    const lines = analysisText.split('\n').filter(line => line.trim().length > 0);
    const lastLine = lines[lines.length - 1] || "";
    
    // UŻYWAJEMY REGEX/SPLIT DO WYŁUSKANIA IMION Z OSTATNIEJ LINII
    const identifiedNames = lastLine
        .replace(/[^A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ,]/g, '') // Usuwa wszystko poza literami i przecinkami
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 2); // Filtruj krótkie słowa
        
    // Tworzymy listę obiektów {id: TEMP_NAME, name: Name}
    const charactersToInit = identifiedNames.map(name => ({
        id: cleanCharId(name),
        name: name
    }));
    
    // --- ZAPIS DANYCH Z RZECZYWISTEJ ANALIZY ---

    const eventId = `E-${CHAPTER_ID}-${VERSION_TIMESTAMP.substring(11, 23).replace(/\D/g, '')}`;
    const analysisSummary = analysisText.substring(0, 600); // Używamy początku tekstu jako podsumowania
    
    
    // 1. Sprawdzenie i utworzenie brakujących rekordów postaci
    await Promise.all(charactersToInit.map(obj => checkOrCreateCharacter(dbClient, obj.id, obj.name)));


    // 2. Zapisz Zdarzenie Fabularne
    const plotEvent = {
        [ID_ZDARZENIA]: eventId, 
        SUMMARY: analysisSummary, 
        SOURCE_CHAPTER_ID: CHAPTER_ID,
        SOURCE_VERSION: VERSION_TIMESTAMP,
        FULL_ANALYSIS: analysisText, // Cała odpowiedź Gemini
        IDENTIFIED_CHARACTERS: charactersToInit.map(obj => obj.id) // Lista ID
    };
    await dbClient.send(new PutCommand({ TableName: PLOT_EVENTS_TABLE, Item: plotEvent }));

    // 3. Zaktualizuj Profile Postaci (Dodajemy logi zmian)
    for (const charData of charactersToInit) { 
        const logEntry = `[${eventId}] - ANALIZA GEMINI: ${analysisSummary}`;

        await dbClient.send(new UpdateCommand({
            TableName: CHARACTERS_TABLE,
            Key: { ID: charData.id },
            UpdateExpression: "SET #log = list_append(if_not_exists(#log, :empty_list), :new_entry)",
            ExpressionAttributeNames: { "#log": "C_3_HISTORIA_ZDARZEN" },
            ExpressionAttributeValues: { ":new_entry": [logEntry], ":empty_list": [] },
        }));
    }
    
    // 4. Zmień STATUS Rozdziału na ANALYZED
    await dbClient.send(new UpdateCommand({
        TableName: CHAPTERS_TABLE,
        Key: { [CHAPTERS_ID]: CHAPTER_ID, [VERSION_ID]: VERSION_TIMESTAMP },
        UpdateExpression: "SET #st = :st, #sum = :sum",
        ExpressionAttributeNames: { "#st": "STATUS", "#sum": "SUMMARY" },
        ExpressionAttributeValues: { ":st": "ANALYZED", ":sum": analysisSummary }
    }));
    
    console.log(`ANALIZA ZAKOŃCZONA: Zidentyfikowano ${charactersToInit.length} postaci.`);
    return { success: true, analysisSummary: analysisSummary };
};


// =======================================================
// HANDLER GŁÓWNY (JEST POPRAWNY)
// =======================================================

export const handler = async (event) => {
    
    if (event.httpMethod === 'OPTIONS') { return { statusCode: 200, headers }; }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body || '{}');
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Niepoprawny format JSON w ciele zapytania.' }) };
    }

    try {
        const { chapterId, title, content } = requestBody;

        if (!chapterId || !title || !content) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Wymagane pola: chapterId, title, content.' }) };
        }
        
        const versionTimestamp = new Date().toISOString(); 
        const chapterItem = {
            [CHAPTERS_ID]: chapterId, 
            [VERSION_ID]: versionTimestamp, 
            TITLE: title,
            CONTENT: content, 
            STATUS: 'RAW' 
        };
        
        // 1. Zapis nowego rekordu (nowa wersja) do DynamoDB
        await db.send(new PutCommand({ TableName: CHAPTERS_TABLE, Item: chapterItem }));

        // 2. SYNCHRONICZNE WYWOŁANIE LOGIKI ANALIZY
        const analysisResult = await runAnalysisLogic(db, chapterItem);
        
        // 3. ZWRACAMY WYNIK
        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ 
                message: `Rozdział ${chapterId} zapisany i pomyślnie przeanalizowany.`, 
                CHAPTER_ID: chapterId,
                VERSION_TIMESTAMP: versionTimestamp,
                STATUS: analysisResult.STATUS || 'ANALYZED',
                ANALYSIS_SUMMARY: analysisResult.analysisSummary 
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
