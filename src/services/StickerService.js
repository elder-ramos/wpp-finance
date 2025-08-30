const { MessageMedia } = require("whatsapp-web.js");
const sharp = require("sharp");

class StickerService {
  _getQualitySettings(pages) {
    if (pages > 100) return { quality: 30, effort: 4, alphaQuality: 40 };
    if (pages > 50) return { quality: 45, effort: 5, alphaQuality: 50 };
    return { quality: 60, effort: 6, alphaQuality: 80 };
  }

  async _convertVideoToSticker(base64Data, ext) {
    console.log(`Vídeo ${ext.toUpperCase()} detectado - criando placeholder`);

    try {
      const placeholderBuffer = await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 4,
          background: { r: 45, g: 55, b: 72, alpha: 1 },
        },
      })
        .composite([
          {
            input: Buffer.from(`
          <svg width="512" height="512">
            <rect width="512" height="512" fill="#2d3748"/>
            <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" 
                  fill="white" font-size="32" font-family="Arial, sans-serif">
               ${ext.toUpperCase()}
            </text>
            <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" 
                  fill="#a0aec0" font-size="18" font-family="Arial, sans-serif">
              Vídeo convertido
            </text>
          </svg>
        `),
            top: 0,
            left: 0,
          },
        ])
        .png()
        .toBuffer();

      return placeholderBuffer.toString("base64");
    } catch (error) {
      console.error("Erro ao criar placeholder:", error);
      throw new Error("Não foi possível processar o vídeo");
    }
  }

  async sendAnimatedSticker(client, chatId, base64Data, ext) {
    try {
      console.log(`Processando ${ext} animado...`);

      const isVideo = !["gif"].includes(ext);

      if (isVideo) {
        // Para vídeos MP4, WebM, etc., cria um placeholder
        console.log(
          `Vídeo ${ext.toUpperCase()} detectado - criando sticker placeholder`
        );

        const placeholderBase64 = await this._convertVideoToSticker(
          base64Data,
          ext
        );
        const webpB64 = await this.base64ToStickerWebp(placeholderBase64);

        const media = new MessageMedia("image/webp", webpB64);
        await client.sendMessage(chatId, media, {
          sendMediaAsSticker: true,
          stickerAuthor: "WPP Finance Bot",
          stickerName: `Sticker ${ext.toUpperCase()}`,
        });

        console.log(`Placeholder ${ext.toUpperCase()} enviado!`);
        return;
      }

      // Para GIFs, processa normalmente
      console.log("Processando GIF animado...");
      await this.sendStickerFromBase64(client, chatId, base64Data);
    } catch (error) {
      console.error(`Erro ${ext}:`, error);
      await this._animatedStickerErrorHandler(client, chatId);
    }
  }

  async _animatedStickerErrorHandler(client, chatId) {
    try {
      console.log("Animated sticker error handler");
      // Envia mensagem de erro para o usuário
      await client.sendMessage(
        chatId,
        "❌ Erro ao processar sua mídia como um sticker animado.\n\nAguarde novas atualizações ou tente enviar uma imagem em formato PNG, JPEG ou GIF."
      );
    } catch (fallbackError) {
      console.error("Erro no fallback também:", fallbackError);
    }
  }

  async base64ToStickerWebp(b64) {
    const input = Buffer.from(b64, "base64");
    const metadata = await sharp(input).metadata();
    const { width, height } = metadata;

    const maxSize = 512;
    const ratio = Math.min(maxSize / width, maxSize / height);
    const newWidth = Math.round(width * ratio);
    const newHeight = Math.round(height * ratio);

    let pipeline = sharp(input);

    if (width < 256 || height < 256) {
      pipeline = pipeline.sharpen({
        sigma: 0.5,
        m1: 0.5,
        m2: 2.0,
        x1: 2,
        y2: 10,
        y3: 20,
      });
    }

    for (let q = 95; q >= 60; q -= 2) {
      const out = await pipeline
        .resize(newWidth, newHeight, {
          kernel: sharp.kernel.lanczos3,
          fit: "inside",
          withoutEnlargement: false,
        })
        .extend({
          top: Math.floor((maxSize - newHeight) / 2),
          bottom: Math.ceil((maxSize - newHeight) / 2),
          left: Math.floor((maxSize - newWidth) / 2),
          right: Math.ceil((maxSize - newWidth) / 2),
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({
          quality: q,
          lossless: false,
          nearLossless: q > 85,
          effort: 6,
          smartSubsample: true,
          alphaQuality: Math.min(q + 5, 100),
          mixed: true,
        })
        .toBuffer();

      if (out.byteLength <= 90_000) return out.toString("base64");
    }
  }

  async sendStickerFromBase64(client, chatId, base64Data) {
    try {
      const input = Buffer.from(base64Data, "base64");
      const metadata = await sharp(input).metadata();

      console.log(
        `Processando: ${metadata.width}x${metadata.height}, ${metadata.format}`
      );

      if (metadata.format === "gif" && metadata.pages > 1) {
        console.log("GIF animado detectado...");
        await this.sendAnimatedSticker(client, chatId, base64Data, "gif");
        return;
      }

      const webpB64 = await this.base64ToStickerWebp(base64Data);

      const media = new MessageMedia("image/webp", webpB64);
      await client.sendMessage(chatId, media, {
        sendMediaAsSticker: true,
        stickerAuthor: "WPP Bot",
        stickerName: "Figurinha HD",
      });

      console.log("Sticker HD enviado!");
    } catch (error) {
      console.error("Erro sticker:", error);
    }
  }

  _getMediaExtension(mimetype) {
    if (mimetype.includes("gif")) return "gif";
    if (mimetype.includes("mp4")) return "mp4";
    if (mimetype.includes("webm")) return "webm";
    if (mimetype.includes("avi")) return "avi";
    if (mimetype.includes("mov")) return "mov";
    return "video";
  }

  async processMedia(client, media, chatId) {
    try {
      if (
        !media ||
        (!media.mimetype.startsWith("image/") &&
          !media.mimetype.startsWith("video/"))
      ) {
        console.log("Mídia não suportada");

        // Envia mensagem explicativa para o usuário
        await client.sendMessage(
          chatId,
          "📎 *Formato não suportado*\n\nPor favor, envie:\n• 🖼️ Imagens\n•🎬 Vídeos\n\nO bot irá converter automaticamente para sticker!"
        );
        return;
      }

      console.log(`Mídia: ${media.mimetype}, ${media.data.length} chars`);

      if (
        media.mimetype === "image/gif" ||
        media.mimetype.startsWith("video/")
      ) {
        const ext = this._getMediaExtension(media.mimetype);
        console.log(`${ext.toUpperCase()} detectado...`);
        await this.sendAnimatedSticker(client, chatId, media.data, ext);
      } else {
        console.log("Imagem estática...");
        await this.sendStickerFromBase64(client, chatId, media.data);
      }
    } catch (error) {
      console.error("Erro processMedia:", error);

      // Envia mensagem de erro geral
      try {
        await client.sendMessage(
          chatId,
          "❌ *Erro interno*\n\nOcorreu um erro inesperado ao processar sua mídia. Tente novamente ou use um formato diferente."
        );
      } catch (msgError) {
        console.error("Erro ao enviar mensagem de erro geral:", msgError);
      }
    }
  }
}

module.exports = StickerService;
