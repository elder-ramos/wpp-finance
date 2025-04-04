import ollama
import chromadb

documents = [
    # Regras de Extração
    ("amount", "extrair_valor_monetario", {"padrao": "R\$\s*([\d.,]+)", "tipo": "float"}),
    ("transaction_date", "extrair_data", {"formato": "%d/%m/%Y", "padrao_data_futura": False}),
    ("payment_method", "definir_padrao", {"valor_padrao": "pix", "opcoes_validas": ["pix", "dinheiro", "cartão_credito", "cartão_debito", "transferencia"]}),

    # Regras de Validação
    ("category/subcategory", "validar_mapa", {"referencia": "CATEGORIAS_FIXAS"}),
    ("transaction_date", "validar_data", {"limite_maximo": "datetime.now()"}),
    ("credit_status", "aplicar_se", {"condicao": "payment_method == 'cartão_credito'", "valor": "pending"}),

    # Regras de Formatação
    ("amount", "converter_decimal", {"casas_decimais": 2}),
    ("transaction_date", "adicionar_horario", {"horario_padrao": "00:00:00"}),

    # Regras de Erro
    ("*", "priorizar_erro", {"ordem": ["valor_invalido", "data_invalida", "metodo_pagamento_invalido"]})
]

client = chromadb.Client()
collection = client.create_collection(name="docs")

# store each document in a vector embedding database
for i, d in enumerate(documents):
  response = ollama.embed(model="mxbai-embed-large", input=d)
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
