import axios from "axios";

class MessagesService {
  async switchMessageType(message) {
    switch (this.messageFirstWord(message)) {
      case "/ia":
        return await this.requestIA(message.replace("/ia", "").trim());
      default:
        return "Unknown command!";
    }
  }

  messageFirstWord(message) {
    const splitMessage = message.split(" ");
    console.log("splitMessage: ", splitMessage[0]);
    if (splitMessage.length > 0) {
      return splitMessage[0];
    }
    return "";
  }

  async requestIA(message) {
    try {
      console.log("Requesting IA...");
      const iaResponse = await axios.post("http://ollama:11434/api/generate", {
        model: "deepseek-r1:1.5b",
        prompt: `
          Instruções: Analise descrições de transações e converta-as em JSON, priorizando precisão.
          Formato JSON: amount (number), description, transaction_date (datetime, default = today), payment_method, category_id, subcategory, credit_status (nullable. always "pending" if is credit card.), total_installments (nullable, optional field, only if payment = credit_card).
          Categorias e subcategorias: 
          [
        {
          "id": 1,
          "Moradia": ["Aluguel", "Condomínio", "IPTU", "Reparos"]
        },
        {
          "id": 2,
          "Alimentação": ["Supermercado", "Restaurantes", "Lanches"]
        },
        {
          "id": 3,
          "Transporte": ["Combustível", "Uber/Táxi/99", "Manutenção do carro"]
        },
        {
          "id": 4,
          "Lazer": ["Cinema", "Viagens", "Hobbies", "Esportes"]
        },
        {
          "id": 5,
          "Assinaturas": ["Streaming", "Serviços"]
        },
        {
          "id": 6,
          "Saúde": ["Médico", "Farmácia", "Academia"]
        },
        {
          "id": 7,
          "Educação": ["Cursos", "Livros", "Material escolar"]
        },
        {
          "id": 8,
          "Dívidas": ["Cartão de crédito", "Empréstimo bancário"]
        },
        {
          "id": 9,
          "Gastos Fixos": ["Contas de luz/água", "Internet", "Seguros"]
        },
        {
          "id": 10,
          "Imprevistos": ["Consertos emergenciais", "Multas"]
        },
        {
          "id": 11,
          "Doações": ["Presentes", "Caridade"]
        },
        {
          "id": 12,
          "Vestuário": ["Roupas", "Cosméticos", "Cabeleireiro"]
        },
        {
          "id": 13,
          "Investimentos": ["Aplicações", "Reserva de emergência"]
        },
        {
          "id": 14,
          "Outros": ["Outros"]
        }
          ]

          Payment_method: dinheiro, pix, cartão_credito, cartão_debito, transferencia. o default deve ser pix.

          Regras:
          - transaction_date: Não pode ser futuro.
          - Use categorias/subcategorias fornecidas.
          - Moeda: Reais (R$).

          Saída: Apenas o JSON. Se inválido, retorne {'error': 'Mensagem de erro'}.
          Com base em tudo dito, analise a seguinte mensagem: '${message}'.`,
        format: "json",
        stream: false,
      });

      console.log("IA Response -> : ", iaResponse.data.response);
      return iaResponse.data.response;
    } catch (error) {
      console.error("Error: ", error);
      return String(error);
    }
  }
}

export default MessagesService;
