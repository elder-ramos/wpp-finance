const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const messagesServiceClass = require("./services/messages.service").default;
const utilServiceClass = require("./services/utils.service").default;
const dbServiceClass = require("./services/db.service").default;

const messagesService = new messagesServiceClass();
const utilsService = new utilServiceClass();
const dbService = new dbServiceClass();

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("message", async (msg) => {
  if (msg.type != "chat") {
    msg.reply("Desculpe, apenas mensagens de texto são suportadas.");
    return;
  }

  const responseMessage = await messagesService.switchMessageType(msg.body);

  console.log("responseMessage: ", responseMessage);
  if (responseMessage.message.content && responseMessage.done == true) {
    const parsedResponse = JSON.parse(responseMessage.message.content);
    const zodValidation =
      messagesService.outputSchema.safeParse(parsedResponse);

    if (!zodValidation.success) {
      console.error("Zod validation error: ", zodValidation.error);
      msg.reply("Desculpe, não consegui entender a mensagem.");
      return;
    }

    const { valor, descricao, categoria, metodo_pagamento, dataResponse } =
      parsedResponse;

    // Aqui você pode fazer o que quiser com os dados extraídos
    dbService
      .transactionCreate({
        valor,
        descricao,
        categoria,
        metodo_pagamento,
        data: dataResponse,
        user_id: msg.from, // Aqui você pode usar o ID do usuário
      })
      .catch((error) => {
        console.error("Error creating transaction: ", error);
      });
    console.log("Transação criada com sucesso!");

    console.log("Valor: ", valor);
    console.log("Descrição: ", descricao);
    console.log("Categoria: ", categoria);
    console.log("Método de Pagamento: ", metodo_pagamento);
    console.log("Data: ", dataResponse);

    msg.reply(
      `Aqui estão os detalhes da sua transação:\n\n` +
        `💰 *Valor:* ${valor}\n` +
        `📝 *Descrição:* ${descricao}\n` +
        `📂 *Categoria:* ${JSON.stringify(categoria)}\n` +
        `💳 *Método de Pagamento:* ${metodo_pagamento}\n` +
        `📅 *Data:* ${dataResponse}\n\n` +
        `Se precisar de algo mais, é só me chamar! 😊`
    );
  }

  const userData = utilsService.extractUserData(msg);
  const [user, created] = await dbService.userFindOrCreate(userData);

  if (created) {
    client.sendMessage(
      msg.from,
      `Bem-vindo ao bot de finanças, ${userData.name}! Você foi cadastrado com sucesso.`
    );
  }
});

client.initialize();
