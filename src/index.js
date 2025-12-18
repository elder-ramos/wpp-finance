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
    const startTime = Date.now();
    try {
      // Baixa a mídia usando o método oficial (mantém qualidade original)
      // Implementa retries para contornar falhas temporárias
      let media;
      let retries = 3;
      while (retries > 0) {
        try {
          media = await msg.downloadMedia();
          break;
        } catch (downloadError) {
          console.warn(`⚠️ Tentativa de download ${4 - retries} falhou: ${downloadError.message}`);
          retries--;
          if (retries === 0) throw downloadError;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Usa o service para processar a mídia
      await stickerService.processMedia(client, media, msg.from);
      
    } catch (error) {
      console.error("Erro ao processar mídia:", error);
      
      // Tratamento específico para o erro de addAnnotations (comum em versões desatualizadas)
      if (error.message && error.message.includes("addAnnotations")) {
        await client.sendMessage(msg.from, "❌ **Erro Crítico**\n\nO WhatsApp Web foi atualizado e o bot precisa de manutenção interna.\n\nPor favor, avise o administrador.");
      } else {
        await client.sendMessage(msg.from, "❌ Erro ao baixar a mídia. Por favor, tente enviar novamente.");
      }
    } finally {
      const totalTime = Date.now() - startTime;
      if (totalTime > 2000) {
        console.log(`⚠️⏱️ Tempo total de processamento: ${totalTime}ms (mais de 2 segundos)`);
      } else {
        console.log(`✅⏱️ Tempo total de processamento: ${totalTime}ms (menos de 2 segundos)`);
      }
    }
    return;
  }
  
  // Processa mensagens de texto normalmente
  if (msg.body) {
    console.log(`Mensagem de texto: ${msg.body}`);
  }
});

client.initialize();
