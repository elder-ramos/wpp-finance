import ollama from "ollama";

class MessagesService {
  ollama = new ollama("http://ollama:11434/api/generate");
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

  async requestIA(message, chatId, messages = []) {
    try {
      console.log("Requesting IA...");
      const iaResponse = await this.ollama.chat({
        model: "deepseek-r1:1.5b",
        template: '',
        messages: [
          ...messages,
          {
            role: "user",
            content: message,
          },
        ],
        options: {
          temperature: 0.5,
          top_p: 0.5,
          max_tokens: 2000,
          num_predict: 5432,
          stop: ["\n\n"],
        },
        prompt: `
          Instruções: Analise descrições de transações e converta-as em JSON, priorizando precisão.
          JSON format: 
          {
          amount (number), 
          description, 
          transaction_date (datetime. default = now. brazillian pattern), 
          payment_method, 
          category, 
          subcategory, 
          credit_status (nullable. always "pending" if is credit card.), 
          total_installments (nullable, optional field, only if payment = credit_card).
          }


        Categorias e subcategorias: 
        [
          {
            "category": "Moradia",
            "subcategories": ["Aluguel", "Condomínio", "IPTU", "Reparos"]
          },
          {
            "category": "Alimentação",
            "subcategories": ["Supermercado", "Restaurantes", "Lanches"]
          },
          {
            "category": "Transporte",
            "subcategories": ["Combustível", "Uber/Táxi/99", "Manutenção do carro"]
          },
          {
            "category": "Lazer",
            "subcategories": ["Cinema", "Viagens", "Hobbies", "Esportes"]
          },
          {
            "category": "Assinaturas",
            "subcategories": ["Streaming", "Serviços"]
          },
          {
            "category": "Saúde",
            "subcategories": ["Médico", "Farmácia", "Academia"]
          },
          {
            "category": "Educação",
            "subcategories": ["Cursos", "Livros", "Material escolar"]
          },
          {
            "category": "Dívidas",
            "subcategories": ["Cartão de crédito", "Empréstimo bancário"]
          },
          {
            "category": "Gastos Fixos",
            "subcategories": ["Contas de luz/água", "Internet", "Seguros"]
          },
          {
            "category": "Imprevistos",
            "subcategories": ["Consertos emergenciais", "Multas"]
          },
          {
            "category": "Doações",
            "subcategories": ["Presentes", "Caridade"]
          },
          {
            "category": "Vestuário",
            "subcategories": ["Roupas", "Cosméticos", "Cabeleireiro"]
          },
          {
            "category": "Investimentos",
            "subcategories": ["Aplicações", "Reserva de emergência"]
          },
          {
            "category": "Outros",
            "subcategories": ["Outros"]
          }
        ]

          Payment_method: dinheiro, pix, cartão_credito, cartão_debito, transferencia. o default deve ser pix.

          Regras:
          - transaction_date: Não pode ser futuro.
          - Use APENAS categorias/subcategorias fornecidas.
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
