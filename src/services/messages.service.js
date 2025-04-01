import axios from "axios";

class MessagesService {
  switchMessageType(message) {
    switch (this.messageFirstWord(message)) {
      case "/add":
        return "Added!";
      case "/remove":
        return "Removed!";
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
      axios
        .post("http://ollama:11434/api/generate", {
          model: "wpp-finance-bot",
          prompt: `
Instruções: Analise descrições de transações e converta-as em JSON, priorizando precisão.

Formato JSON: amount, description, transaction_date, payment_method, category_id, subcategory, credit_status, installment_number, total_installments.

Categorias->[subcategorias]: Moradia->["Aluguel", "Condomínio", "IPTU", "Reparos"], Alimentação->["Supermercado", "Restaurantes", "Lanches"], Transporte->["Combustível", "Uber/Táxi/99", "Manutenção do carro"], Lazer->["Cinema", "Viagens", "Hobbies", "Esportes"], Assinaturas->["Streaming", "Serviços"], Saúde->["Médico", "Farmácia", "Academia"], Educação->["Cursos", "Livros", "Material escolar"], Dívidas->["Cartão de crédito", "Empréstimo bancário"], Gastos Fixos->["Contas de luz/água", "Internet", "Seguros"], Imprevistos->["Consertos emergenciais", "Multas"], Doações->["Presentes", "Caridade"], Vestuário->["Roupas", "Cosméticos", "Cabeleireiro"], Investimentos->["Aplicações", "Reserva de emergência"], Outros->["Outros"].


Regras:
- transaction_date: Não pode ser futuro.
- payment_method: dinheiro, pix, cartão_credito, cartão_debito, transferencia.
- Use categorias/subcategorias fornecidas.
- Moeda: BRL.

Erros:
 - 101	MISSING_AMOUNT
 - 102	INVALID_DATE

Saída: Apenas o JSON. Se inválido, retorne {"error": "Mensagem de erro"}.

Com base em tudo dito, analise a seguinte mensagem: "${message}".`,
          format: "json",
          stream: false,
        })
        .then((response) => {
          if (response.done_reason != "stop") {
            console.error("Error: ", response);
            return "Erro ao processar a mensagem.";
          } else {
            console.log("Response: ", response);
            return response.response;
          }
        });
    } catch (error) {
      console.error("Error: ", error);
      return String(error);
    }
  }
}

export default MessagesService;
