import { Client, LocalAuth } from "whatsapp-web.js";
import { generate } from "qrcode-terminal";
import messagesServiceClass from "./services/messages.service";
import utilServiceClass from "./services/utils.service";
import { Sequelize } from "sequelize";

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
  generate(qr, { small: true });
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
  await msg.reply(responseMessage);

  console.log("Passou de tudo");

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
});

client.initialize();
