const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { StickerService } = require("./services");

// Inicializa o service de stickers
const stickerService = new StickerService();

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
  console.log("QR code recebido, escaneie-o com o aplicativo do WhatsApp.");
});

client.on("ready", async () => {
  console.log("Client is ready!");
});

client.on("message", async (msg) => {
  // Verifica se a mensagem tem mídia
  if (msg.hasMedia) {
    try {
      console.log("Baixando mídia...");
      
      // Baixa a mídia usando o método oficial (mantém qualidade original)
      const media = await msg.downloadMedia();
      
      // Usa o service para processar a mídia
      await stickerService.processMedia(client, media, msg.from);
      
    } catch (error) {
      console.error("Erro ao processar mídia:", error);
    }
    return;
  }
  
  // Processa mensagens de texto normalmente
  if (msg.body) {
    console.log(`Mensagem de texto: ${msg.body}`);
  }
});

client.initialize();
