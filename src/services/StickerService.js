const { MessageMedia } = require("whatsapp-web.js");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const os = require("os");
const crypto = require("crypto");

class StickerService {
  constructor() {
    this.ffmpegAvailable = null;
  }

  async _checkFFmpegAvailability() {
    if (this.ffmpegAvailable !== null) {
      console.log(
        `🔄 Cache FFmpeg: ${
          this.ffmpegAvailable ? "Disponível" : "Indisponível"
        }`
      );
      return this.ffmpegAvailable;
    }

    console.log("🔍 Verificando disponibilidade do FFmpeg...");

    try {

      await new Promise((resolve, reject) => {
        const { exec } = require("child_process");
        const timeoutId = setTimeout(() => {
          reject(new Error("Timeout FFmpeg (2s)"));
        }, 2000);

        exec("ffmpeg -version", (error, stdout, stderr) => {
          clearTimeout(timeoutId);
          if (error) {
            console.log("❌ FFmpeg erro exec:", error.code);
            reject(error);
          } else {
            console.log("✅ FFmpeg responde ao comando -version");
            resolve();
          }
        });
      });

      this.ffmpegAvailable = true;
      console.log("✅ FFmpeg está disponível e funcionando");
    } catch (error) {
      this.ffmpegAvailable = false;
      console.log(
        `❌ FFmpeg não disponível: ${
          error.message || error.code || "Erro desconhecido"
        }`
      );
    }

    return this.ffmpegAvailable;
  }

  _getQualitySettings(pages) {
    if (pages > 100) return { quality: 30, effort: 4, alphaQuality: 40 };
    if (pages > 50) return { quality: 45, effort: 5, alphaQuality: 50 };
    return { quality: 60, effort: 6, alphaQuality: 80 };
  }

  async _videoToWebp(base64Data, ext) {
    const id = crypto.randomBytes(6).toString("hex");
    const inputPath = path.join(os.tmpdir(), `wpp_in_${id}.${ext}`);
    const outputPath = path.join(os.tmpdir(), `wpp_out_${id}.webp`);

    fs.writeFileSync(inputPath, Buffer.from(base64Data, "base64"));

    const attempts = [
      { quality: 40, size: 512, duration: 5 },
      { quality: 20, size: 512, duration: 3 },
      { quality: 8, size: 400, duration: 2 },
    ];

    try {
      for (const attempt of attempts) {
        const filter = `fps=15,scale=${attempt.size}:${attempt.size}:force_original_aspect_ratio=decrease,format=rgba,pad=${attempt.size}:${attempt.size}:(ow-iw)/2:(oh-ih)/2:color=#00000000`;
        const cmd = `ffmpeg -y -i "${inputPath}" -vcodec libwebp -vf "${filter}" -loop 0 -q:v ${attempt.quality} -preset picture -an -vsync 0 -t ${attempt.duration} "${outputPath}"`;

        await new Promise((resolve, reject) => {
          exec(cmd, { timeout: 60000 }, (err) => (err ? reject(err) : resolve()));
        });

        if (!fs.existsSync(outputPath)) {
          throw new Error("FFmpeg não gerou o arquivo WebP");
        }

        const buffer = fs.readFileSync(outputPath);
        console.log(`WebP q=${attempt.quality}: ${Math.round(buffer.length / 1024)}KB`);

        if (buffer.length <= 500 * 1024) {
          return buffer.toString("base64");
        }
      }

      throw new Error("Não foi possível reduzir o sticker para menos de 500KB");
    } finally {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  }

  async sendAnimatedSticker(client, chatId, base64Data, ext) {
    try {
      if (ext === "gif") {
        await this.sendStickerFromBase64(client, chatId, base64Data);
        return;
      }

      const ffmpegAvailable = await this._checkFFmpegAvailability();
      if (!ffmpegAvailable) {
        await client.sendMessage(
          chatId,
          `⚠️ **FFmpeg não disponível no servidor**\n\n` +
            `O vídeo ${ext.toUpperCase()} não pode ser convertido para sticker animado.\n\n` +
            `💡 **Alternativas:**\n` +
            `• Envie **GIFs animados** (funcionam perfeitamente)\n` +
            `• Use **imagens estáticas** para stickers normais`
        );
        return;
      }

      const webpB64 = await this._videoToWebp(base64Data, ext);
      const media = new MessageMedia("image/webp", webpB64);

      await client.sendMessage(chatId, media, {
        sendMediaAsSticker: true,
        stickerAuthor: "WPP Bot",
        stickerName: "Sticker Animado",
      });

      console.log(`Sticker animado ${ext.toUpperCase()} enviado`);
    } catch (error) {
      console.error(`Erro no processamento ${ext}:`, error.message);
      await this._animatedStickerErrorHandler(client, chatId, ext);
    }
  }

  async _animatedStickerErrorHandler(client, chatId, ext = "") {
    try {
      console.log("Animated sticker error handler");

      const ffmpegAvailable = await this._checkFFmpegAvailability();

      await client.sendMessage(
        chatId,
        `❌ **Erro ao processar ${ext ? ext.toUpperCase() : "mídia"}**\n\n` +
          "• ✅ **GIFs**: Processamento direto\n" +
          `• ${ffmpegAvailable ? "✅" : "⚠️"} **Vídeos MP4/WebM/AVI**: ${
            ffmpegAvailable
              ? "Conversão com FFmpeg"
              : "Placeholder (FFmpeg indisponível)"
          }\n\n` +
          "💡 **Possíveis causas do erro:**\n" +
          "• Arquivo muito grande\n" +
          "• Formato não suportado\n" +
          "• Vídeo muito longo (limite: 5 segundos)\n" +
          `${!ffmpegAvailable ? "• FFmpeg não instalado no ambiente\n" : ""}` +
          "\n🔄 **Tente novamente com um arquivo menor ou envie um GIF!**"
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
        console.log("GIF animado detectado - processando diretamente...");

        const qualitySettings = this._getQualitySettings(metadata.pages);

        const webpB64 = await sharp(input)
          .webp({
            quality: qualitySettings.quality,
            lossless: false,
            effort: qualitySettings.effort,
            smartSubsample: true,
            alphaQuality: qualitySettings.alphaQuality,
            animated: true, // Preserva animação
          })
          .toBuffer()
          .then((buffer) => buffer.toString("base64"));

        const media = new MessageMedia("image/webp", webpB64);
        await client.sendMessage(chatId, media, {
          sendMediaAsSticker: true,
          stickerAuthor: "WPP Bot",
          stickerName: "GIF Animado",
        });

        console.log("GIF animado enviado!");
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
    console.log("🎯 === INICIANDO PROCESSAMENTO DE MÍDIA ===");

    try {
      if (!media) {
        console.log("❌ Nenhuma mídia fornecida");
        await client.sendMessage(
          chatId,
          "❌ Nenhuma mídia foi enviada. Por favor, envie uma imagem, GIF ou vídeo."
        );
        return;
      }

      console.log(`📋 Informações da mídia:`);
      console.log(`   Type: ${media.mimetype || "desconhecido"}`);
      console.log(`   Size: ${media.data ? media.data.length : 0} chars`);
      console.log(`   Data exists: ${!!media.data}`);

      if (
        !media.mimetype ||
        (!media.mimetype.startsWith("image/") &&
          !media.mimetype.startsWith("video/"))
      ) {
        console.log("⚠️ Formato de mídia não suportado");

        const ffmpegAvailable = await this._checkFFmpegAvailability();

        await client.sendMessage(
          chatId,
          "📎 *Formato não suportado*\n\nPor favor, envie:\n• 🖼️ **Imagens** (JPG, PNG)\n• 🎬 **Vídeos** (MP4, WebM, AVI, MOV)\n• 🎞️ **GIFs animados**\n\n" +
            `${
              ffmpegAvailable
                ? "✨ O bot converte automaticamente para stickers animados!"
                : "⚠️ Vídeos geram placeholders (FFmpeg indisponível)\n💡 GIFs funcionam perfeitamente!"
            }`
        );
        return;
      }

      console.log(
        `📊 Mídia válida: ${media.mimetype}, ${media.data.length} chars`
      );

      const isAnimated =
        media.mimetype === "image/gif" || media.mimetype.startsWith("video/");
      console.log(`🎬 Mídia animada: ${isAnimated}`);

      if (isAnimated) {
        const ext = this._getMediaExtension(media.mimetype);
        console.log(`🎯 Extensão detectada: ${ext.toUpperCase()}`);
        console.log(`🚀 Chamando sendAnimatedSticker...`);

        await this.sendAnimatedSticker(client, chatId, media.data, ext);
        console.log(
          `✅ sendAnimatedSticker concluído para ${ext.toUpperCase()}`
        );
      } else {
        console.log("🖼️ Processando imagem estática...");
        await this.sendStickerFromBase64(client, chatId, media.data);
        console.log("✅ Imagem estática processada");
      }

      console.log("🎉 === PROCESSAMENTO CONCLUÍDO COM SUCESSO ===");
    } catch (error) {
      console.error("💥 === ERRO CRÍTICO NO PROCESSAMENTO ===");
      console.error("📋 Detalhes:", error.message);
      console.error("📊 Stack:", error.stack);
      console.error("🔍 Mídia info:", {
        mimetype: media?.mimetype,
        dataLength: media?.data?.length,
        hasData: !!media?.data,
      });

      try {
        await client.sendMessage(
          chatId,
          "❌ *Erro interno no processamento*\n\nOcorreu um erro inesperado ao processar sua mídia.\n\n🔄 **Tente:**\n• Enviar um arquivo menor\n• Usar formato diferente (GIF/JPG/PNG)\n• Tentar novamente em alguns segundos"
        );
        console.log("📨 Mensagem de erro geral enviada");
      } catch (msgError) {
        console.error(
          "🚨 Erro ao enviar mensagem de erro geral:",
          msgError.message
        );
      }
    }
  }
}

module.exports = StickerService;
