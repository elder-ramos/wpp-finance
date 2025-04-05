import { Ollama } from "ollama";
import { ChromaClient } from "chromadb";

const documents = [
    "Extrair valor monetário no formato R$ X.XXX,XX e converter para número decimal",
    "Identificar datas no padrão DD/MM/AAAA com validação contra datas futuras",
    "Método de pagamento deve ser: pix/dinheiro/cartão_credito/cartão_debito/transferencia (padrão: pix)",
    "Mapear categorias e subcategorias exclusivamente da lista fornecida",
    "Cartão de crédito sempre define credit_status=pending e exige total_installments se aplicável",
    "Termos como 'hoje' ou 'ontem' devem ser convertidos para datas reais",
    "Erros prioritários: valor ausente > data inválida > método de pagamento não reconhecido",
    "Descrições devem identificar entidades-chave: Supermercado → Alimentação, Netflix → Streaming",
    "Ignorar caracteres não numéricos no valor monetário exceto vírgula decimal",
    "Campos opcionais omitidos devem ser excluídos do JSON final",
];

const client = new ChromaClient();
const ollama = new Ollama({
    host: "http://ollama:11434",
    model: "deepseek-r1:1.5b",
});

async function processDocuments() {
    const collection = await client.createCollection({ name: "docs" });

    for (const [index, doc] of documents.entries()) {
        try {
            const response = await ollama.embed({
                model: "mxbai-embed-large",
                input: doc
            });
            const embedding = response.embeddings;
            await collection.add({
                embedding: embedding,
                documents: [doc],
                index: index
            });
        } catch (error) {
            console.error(`Error processing document at index ${index}:`, error);
        }
    }

    let input = "Eu comprei 50 reais de doces em Claudia Cakes";

    try {
        const response = await ollama.embed({
            model: "mxbai-embed-large",
            input: input
        });
        console.log("Embedding for input:", response.embeddings);
    } catch (error) {
        console.error("Error processing input:", error);
    }
}

processDocuments();