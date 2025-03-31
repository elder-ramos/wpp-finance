const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const pg = require("pg");
const messagesServiceClass = require("./services/messages.service").default;
const utilServiceClass = require("./services/utils.service").default;
const User = require("../models/user");

const messagesService = new messagesServiceClass();
const utilsService = new utilServiceClass();

// const dbClient = new pg.Pool({
//   host: process.env.DB_HOST, // Nome do serviço no docker-compose
//   port: process.env.DB_PORT, // Porta interna do container PostgreSQL
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   ssl:
//     process.env.NODE_ENV === "production"
//       ? { rejectUnauthorized: false }
//       : false,
// });

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
  };
  console.log("message: ", msg.body);
  console.log("Message console: ", msg);
  const userData = utilsService.extractUserData(msg);
  const _User = await User.findOrCreate({
    where: { phone: userData.phone },
    defaults: { user_name: userData.name }
  })
  const automaticResponse = messagesService.switchMessageType(msg.body);
  msg.reply(automaticResponse);
});

client.initialize();
