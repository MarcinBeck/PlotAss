// Importuj moduły AWS SDK
const AWS = require('aws-sdk');
// Używamy DocumentClient, który automatycznie konwertuje JSON <-> Niskopoziomowy format DynamoDB
const db = new AWS.DynamoDB.DocumentClient(); 

// Zmienna globalna dla tabeli (zmienisz nazwę na swoją)
const CHARACTERS_TABLE = 'LLM_Characters'; 
const PLOT_EVENTS_TABLE = 'LLM_PlotEvents';

exports.handler = async (event) => {
    // 1. Odbiór danych z Frontendu
    const requestBody = JSON.parse(event.body);
    const { postacId, opisSceny } = requestBody;
    
    // Zapewnienie, że wymagane dane są obecne
    if (!postacId || !opisSceny) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Brak postacId lub opisSceny w zapytaniu.' })
        };
    }

    // 2. Logika Tworzenia Dynamicznego Profilu (Odczyt z DynamoDB)
    try {
        // --- A. Pobierz Bazowy Profil (DocumentClient upraszcza JSON) ---
        const charParams = {
            TableName: CHARACTERS_TABLE,
            Key: { 'ID': postacId }
        };
        const charData = await db.get(charParams).promise();
        
        if (!charData.Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: `Nie znaleziono postaci o ID: ${postacId}` })
            };
        }
        
        // DynamicProfile to nasz obiekt JSON (DocumentClient konwertuje z formatu 'S':'value')
        let dynamicProfile = charData.Item; 
        
        // W przyszłości: TUTAJ wczytamy i nałożymy zmiany z PLOT_EVENTS
        
        // 3. Budowanie Promptu dla LLM
        // Konwertujemy dynamicProfile z powrotem do JSON string, aby LLM go przetworzył
        const prompt = `Jesteś zaawansowanym weryfikatorem fabuły. Bohater o profilu: ${JSON.stringify(dynamicProfile)} ma zareagować na sytuację: "${opisSceny}". Zwróć JEDYNIE obiekt JSON: {reakcja: "", uzasadnienie: "", spojnosc: "TAK/NIE"}.`;

        // 4. Symulacja Wywołania LLM (dopóki nie skonfigurujemy Bedrock)
        const llmResult = {
            reakcja: "Odrzucenie Humoru, Żądanie FAKTÓW.",
            uzasadnienie: `Profil Tarasa jest spójny: niska Ugodowość i trauma (śmierć Mracika) uniemożliwiają mu swobodną interakcję.`,
            spojnosc: 'TAK'
        };

        // 5. Zwracanie Wyniku do Frontendu
        return {
            statusCode: 200,
            headers: { 
                "Content-Type": "application/json",
                // Nagłówki do testowania CORS z Frontendu
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(llmResult)
        };

    } catch (error) {
        console.error("Błąd weryfikacji:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
