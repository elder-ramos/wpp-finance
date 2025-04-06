import { Ollama } from "ollama";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { Constants } from "../../constants.js";

const outputSchema = z.object({
  valor: z.number().nonnegative(),
  descricao: z.string(),
  categoria: z.enum(Constants.CATEGORIES),
  // subcategoria: "Livros",
  metodo_pagamento: z.enum([
    "dinheiro",
    "pix",
    "cartão_credito",
    "cartão_debito",
  ]).default("pix"),
  data: z.date().default(new Date()),
  parcelas: z.number().optional(),
});
class MessagesService {
  ollama = new Ollama({ host: "http://ollama:11434/api/generate" });

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
        template: "",
        messages: [
          {
            role: "system",
            content: `Você é um assistente de IA que analisa mensagens e converte em JSON. Você deve seguir as instruções e regras fornecidas.`,
          },
          {
            role: "system",
            content: `Você deve seguir o seguinte formato de saída: ${zodToSchema(outputSchema)}`,
          },
          ...messages,
          {
            role: "user",
            content: message,
          },
        ],
        format: zodToJsonSchema(outputSchema),
        options: {
          num_predict: 5432,
          stop: ["\n\n"],
        },
        prompt: `
          Instruções: Analise descrições de transações e converta-as em JSON, priorizando precisão.
          Exemplo de entrada: "Eu comprei 50 reais de doces em Claudia Cakes"
          Exemplo de saída: {"valor": 50, "descricao": "doces", "categoria": "Alimentação", "metodo_pagamento": "pix", "data": "2023-10-01"}
          
          Regras:
          - transaction_date: Não pode ser futuro.
          - Use APENAS categorias/subcategorias fornecidas.
          - Moeda: Reais (R$).

          Saída: Apenas o JSON. Se inválido, retorne {'error': 'Mensagem de erro'}.
          Com base em tudo dito, analise a seguinte mensagem: '${message}'.`,
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
