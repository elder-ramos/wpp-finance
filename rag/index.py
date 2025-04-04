import ollama
import chromadb

documents = [
  "Extrair valor monetário no formato R$ X.XXX,XX e converter para número decimal",
  "Identificar datas no padrão DD/MM/AAAA com validação contra datas futuras",
  "Método de pagamento deve ser: pix/dinheiro/cartão_credito/cartão_debito/transferencia (padrão: pix)",
  "Mapear categorias e subcategorias exclusivamente da lista fornecida",
  "Cartão de crédito sempre define credit_status=pending e exige total_installments se aplicável",
  "Termos como 'hoje' ou 'ontem' devem ser convertidos para datas reais",
  "Erros prioritários: valor ausente > data inválida > método de pagamento não reconhecido",
  "Descrições devem identificar entidades-chave: Supermercado → Alimentação, Netflix → Streaming",
  "Ignorar caracteres não numéricos no valor monetário exceto vírgula decimal",
  "Campos opcionais omitidos devem ser excluídos do JSON final"
]

client = chromadb.Client()
collection = client.create_collection(name="docs")
ollamaClient = ollama.Client(
  host='http://ollama:11434'
)

# store each document in a vector embedding database
for i, d in enumerate(documents):
  response = ollamaClient.embed(model="mxbai-embed-large", input=d)
  embeddings = response["embeddings"]
  collection.add(
    ids=[str(i)],
    embeddings=embeddings,
    documents=[d]
  )

# an example input
input = "What animals are llamas related to?"

# generate an embedding for the input and retrieve the most relevant doc
response = ollama.embed(
  model="mxbai-embed-large",
  input=prompt
)
results = collection.query(
  query_embeddings=[response["embeddings"]],
  n_results=1
)
data = results['documents'][0][0]

print(data)
