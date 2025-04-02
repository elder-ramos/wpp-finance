const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const messagesServiceClass = require("./services/messages.service").default;
const utilServiceClass = require("./services/utils.service").default;
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  "postgres://user:password@postgres:5432/postgres"
);
const Users = sequelize.define(
  "Users",
  {
    phone: {
      type: Sequelize.STRING(30),
      allowNull: false,
      primaryKey: true,
    },
    user_name: {
      type: Sequelize.STRING(50),
      allowNull: false,
    },
  },
  {
    timestamps: true,
  }
);

const messagesService = new messagesServiceClass();
const utilsService = new utilServiceClass();

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

  if (msg.body == "/ia") {
    const iaResponse = await messagesService.requestIA(msg.body);
    console.log("iaResponse: ", iaResponse);
    await msg.reply(iaResponse);
    return;
  }

  const userData = utilsService.extractUserData(msg);
  const [_User, created] = await Users.findOrCreate({
    where: { phone: userData.phone },
    defaults: { user_name: userData.name },
  });
  if (created) {
    client.sendMessage(
      msg.from,
      `Bem-vindo ao bot de finanças, ${userData.name}! Você foi cadastrado com sucesso.`
    );
  }
  const automaticResponse = messagesService.switchMessageType(msg.body);
  msg.reply(automaticResponse);
});

client.initialize();
