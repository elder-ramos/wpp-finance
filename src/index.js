const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const { StickerService } = require("./services");
const StickerQueue = require("./queue/StickerQueue");

const app = express();
app.use(express.json());

const stickerService = new StickerService();
const stickerQueue = new StickerQueue(3);

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
  if (msg.hasMedia) {
    const jobId = `sticker-${msg.id}-${Date.now()}`;
    const queueSize = stickerQueue.getQueueSize();

    if (queueSize > 0) {
      await client.sendMessage(
        msg.from,
        `⏳ Seu sticker está na fila!\n\n📊 Posição na fila: ${queueSize + 1}\n\nVocê será notificado quando ficar pronto.`
      );
    } else {
      await client.sendMessage(
        msg.from,
        `⏳ Processando seu sticker...\n\nIsso pode levar alguns segundos.`
      );
    }

    stickerQueue.enqueue(async () => {
      const startTime = Date.now();
      try {
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

        await stickerService.processMedia(client, media, msg.from);

      } catch (error) {
        console.error("Erro ao processar mídia:", error);

        if (error.message && error.message.includes("addAnnotations")) {
          await client.sendMessage(
            msg.from,
            "❌ **Erro Crítico**\n\nO WhatsApp Web foi atualizado e o bot precisa de manutenção interna.\n\nPor favor, avise o administrador."
          );
        } else {
          await client.sendMessage(
            msg.from,
            "❌ Erro ao processar a mídia. Por favor, tente enviar novamente."
          );
        }
      } finally {
        const totalTime = Date.now() - startTime;
        if (totalTime > 2000) {
          console.log(`⚠️⏱️ Tempo total de processamento: ${totalTime}ms (mais de 2 segundos)`);
        } else {
          console.log(`✅⏱️ Tempo total de processamento: ${totalTime}ms (menos de 2 segundos)`);
        }
      }
    }, jobId);

    return;
  }

  if (msg.body) {
    console.log(`Mensagem de texto: ${msg.body}`);
  }
});

const fs = require("fs");
const path = require("path");

const lockFile = path.join(process.cwd(), ".wwebjs_auth", "session", "SingletonLock");
try {
  if (fs.existsSync(lockFile)) {
    fs.unlinkSync(lockFile);
    console.log("🔒 Arquivo SingletonLock antigo removido com sucesso.");
  }
} catch (e) {
  console.error("Erro ao tentar remover SingletonLock:", e.message);
}

client.initialize();

app.post("/api/send", async (req, res) => {
  try {
    const { to, body } = req.body;

    if (!to || !body) {
      return res.status(400).json({ error: "Campos 'to' e 'body' são obrigatórios." });
    }

    const chatId = `${to}@c.us`;

    client.sendMessage(chatId, body).catch(err => {
      console.error(`Erro ao enviar mensagem via API para ${to}:`, err);
    });

    return res.status(202).json({ status: "queued", message: "Mensagem enfileirada para envio" });
  } catch (error) {
    console.error("Erro no endpoint /api/send:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor HTTP rodando na porta ${PORT}`);
});
