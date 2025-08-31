const { MessageMedia } = require("whatsapp-web.js");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const { spawn, exec } = require("child_process");

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
      // Teste mais simples e direto
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

  async _convertVideoToSticker(base64Data, ext) {
    console.log(`🎬 Iniciando conversão ${ext.toUpperCase()} com FFmpeg...`);
    console.log(
      `📊 Tamanho do vídeo: ${base64Data.length} chars (${
        Math.round(((base64Data.length * 0.75) / 1024 / 1024) * 100) / 100
      } MB aprox.)`
    );

    const tempDir = path.join(__dirname, "../../temp");
    if (!fs.existsSync(tempDir)) {
      console.log("📁 Criando diretório temp...");
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const inputPath = path.join(tempDir, `input_${timestamp}.${ext}`);
    const outputPath = path.join(tempDir, `output_${timestamp}.gif`);

    console.log(`📂 Arquivos temporários:`);
    console.log(`   Input: ${inputPath}`);
    console.log(`   Output: ${outputPath}`);

    try {
      // Salva o vídeo base64 como arquivo temporário
      console.log("💾 Salvando vídeo como arquivo temporário...");
      const videoBuffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(inputPath, videoBuffer);
      console.log(`✅ Arquivo salvo: ${fs.statSync(inputPath).size} bytes`);

      // Converte vídeo para GIF usando FFmpeg com timeout
      console.log("🔄 Iniciando conversão FFmpeg...");
      await Promise.race([
        new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .inputOptions([
              "-t 5", // Reduz para 5 segundos para menos frames
              "-ss 0", // Inicia do segundo 0
            ])
            .outputOptions([
              "-vf scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=8", // 8 FPS, fundo transparente
              "-f gif",
              "-loop 0", // Loop infinito
            ])
            .output(outputPath)
            .on("start", (commandLine) => {
              console.log("🚀 FFmpeg iniciado:", commandLine);
            })
            .on("progress", (progress) => {
              console.log(
                `⏳ Progresso: ${
                  progress.percent ? Math.round(progress.percent) : "?"
                }%`
              );
            })
            .on("end", () => {
              console.log("✅ Conversão FFmpeg concluída");
              resolve();
            })
            .on("error", (err) => {
              console.error("❌ Erro FFmpeg durante conversão:", err.message);
              reject(err);
            })
            .run();
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Timeout na conversão FFmpeg (60s)")),
            60000
          )
        ),
      ]);

      // Verifica se o arquivo foi criado
      if (!fs.existsSync(outputPath)) {
        throw new Error("Arquivo GIF não foi gerado pelo FFmpeg");
      }

      // Lê o GIF gerado e converte para base64
      console.log("📖 Lendo GIF gerado...");
      const gifBuffer = fs.readFileSync(outputPath);
      const gifBase64 = gifBuffer.toString("base64");

      console.log(
        `📊 GIF gerado: ${gifBuffer.length} bytes (${
          Math.round((gifBuffer.length / 1024 / 1024) * 100) / 100
        } MB)`
      );
      console.log(`📝 Base64: ${gifBase64.length} chars`);

      // Limpa arquivos temporários
      console.log("🧹 Limpando arquivos temporários...");
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
        console.log("🗑️ Input removido");
      }
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
        console.log("🗑️ Output removido");
      }

      console.log("🎉 Conversão concluída com sucesso!");
      return gifBase64;
    } catch (error) {
      console.error(
        `💥 Erro na conversão ${ext.toUpperCase()}:`,
        error.message
      );
      console.error("📊 Detalhes do erro:", error);

      // Limpa arquivos temporários em caso de erro
      console.log("🧹 Limpando arquivos temporários (erro)...");
      try {
        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath);
          console.log("🗑️ Input removido (erro)");
        }
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
          console.log("🗑️ Output removido (erro)");
        }
      } catch (cleanupError) {
        console.error("⚠️ Erro na limpeza:", cleanupError.message);
      }

      throw new Error(
        `Falha na conversão ${ext.toUpperCase()}: ${error.message}`
      );
    }
  }

  async sendAnimatedSticker(client, chatId, base64Data, ext) {
    console.log(
      `🎬 Iniciando processamento de ${ext.toUpperCase()}: ${
        base64Data.length
      } chars`
    );

    try {
      const isVideo = !["gif"].includes(ext);
      console.log(`📝 Tipo de mídia: ${isVideo ? "Vídeo" : "GIF"}`);

      if (isVideo) {
        console.log(`🔧 Processando vídeo ${ext.toUpperCase()}...`);

        // Verifica FFmpeg com timeout reduzido
        let ffmpegAvailable = false;
        try {
          console.log("⏳ Verificando FFmpeg...");
          ffmpegAvailable = await Promise.race([
            this._checkFFmpegAvailability(),
            new Promise((resolve) => setTimeout(() => resolve(false), 5000)),
          ]);
          console.log(`🎯 Resultado FFmpeg: ${ffmpegAvailable}`);
        } catch (checkError) {
          console.error("❌ Erro na verificação FFmpeg:", checkError.message);
          ffmpegAvailable = false;
        }

        if (!ffmpegAvailable) {
          console.log(
            `⚠️ FFmpeg indisponível para ${ext.toUpperCase()}, enviando mensagem de aviso...`
          );

          await client.sendMessage(
            chatId,
            `⚠️ **FFmpeg não disponível no servidor**\n\n` +
              `O vídeo ${ext.toUpperCase()} não pode ser convertido para sticker animado.\n\n` +
              `💡 **Alternativas:**\n` +
              `• Envie **GIFs animados** (funcionam perfeitamente)\n` +
              `• Use **imagens estáticas** para stickers normais\n\n` +
              `🔧 **Status técnico:** FFmpeg não instalado ou inacessível`
          );

          console.log("✅ Mensagem de aviso enviada, processamento finalizado");
          return;
        }

        // Se FFmpeg está disponível, tenta converter
        console.log(
          `🚀 FFmpeg disponível, iniciando conversão ${ext.toUpperCase()} → GIF...`
        );
        try {
          const gifBase64 = await this._convertVideoToSticker(base64Data, ext);
          console.log(
            `✅ Conversão concluída, GIF gerado: ${gifBase64.length} chars`
          );

          // Processa o GIF gerado como ANIMADO
          console.log("📦 Enviando sticker ANIMADO a partir do GIF gerado...");
          await this._sendAnimatedGifSticker(client, chatId, gifBase64);

          console.log(
            `🎉 Sticker animado ${ext.toUpperCase()} enviado com sucesso!`
          );
          return;
        } catch (conversionError) {
          console.error(
            `❌ Erro na conversão ${ext.toUpperCase()}:`,
            conversionError.message
          );
          throw conversionError;
        }
      }

      // Para GIFs, processa diretamente
      console.log("🎞️ Processando GIF animado diretamente...");
      await this.sendStickerFromBase64(client, chatId, base64Data);
      console.log("✅ GIF animado processado com sucesso!");
    } catch (error) {
      console.error(`💥 Erro crítico no processamento ${ext}:`, error.message);
      console.error("📊 Stack trace:", error.stack);

      try {
        await this._animatedStickerErrorHandler(client, chatId, ext);
        console.log("📨 Mensagem de erro enviada ao usuário");
      } catch (handlerError) {
        console.error(
          "🚨 Erro ao enviar mensagem de erro:",
          handlerError.message
        );
      }
    }
  }

  async _sendAnimatedGifSticker(client, chatId, gifBase64) {
    console.log("🎞️ Processando GIF/MP4 como sticker animado via FFmpeg...");

    const inputPath = `./temp_input_${Date.now()}.gif`;
    const outputPath = `./temp_sticker_${Date.now()}.webp`;

    try {
      // Salva o GIF/MP4 temporário
      fs.writeFileSync(inputPath, Buffer.from(gifBase64, "base64"));

      console.log("⚙️ Calculando qualidade ideal para WebP animado...");

      // Primeiro, testa com qualidade média para estimar tamanho
      const testQuality = 60;
      console.log(`🧮 Testando qualidade ${testQuality}% para estimativa...`);

      const testCmd = `ffmpeg -y -i "${inputPath}" \
-vcodec libwebp \
-filter_complex "[0:v] fps=12,crop='min(iw,ih)':'min(iw,ih)',scale=512:512:flags=lanczos,format=rgba" \
-loop 0 -q:v ${Math.round(testQuality * 0.8)} -preset picture -an -vsync 0 -t 5 "${outputPath}"`;

      await new Promise((resolve, reject) => {
        exec(testCmd, (err, stdout, stderr) => {
          if (err) {
            console.error("❌ Erro no FFmpeg (teste):", stderr);
            return reject(err);
          }
          resolve();
        });
      });

      if (!fs.existsSync(outputPath)) {
        throw new Error("Arquivo WebP de teste não foi gerado");
      }

      const testBuffer = fs.readFileSync(outputPath);
      const testSizeKB = Math.round(testBuffer.length / 1024);
      console.log(
        `📊 Tamanho teste (qualidade ${testQuality}%): ${testSizeKB} KB`
      );

      // Remove arquivo de teste
      fs.unlinkSync(outputPath);

      // Calcula qualidade ideal baseada na proporção
      const targetSizeKB = 450; // 450KB para ter margem de segurança (meta: <500KB)
      const sizeRatio = testSizeKB / targetSizeKB;

      let calculatedQuality;
      if (sizeRatio <= 1.0) {
        // Se já está no tamanho ideal, pode até aumentar um pouco a qualidade
        calculatedQuality = Math.min(80, Math.round(testQuality * 1.1));
      } else {
        // Calcula redução necessária (relação não-linear entre qualidade e tamanho)
        const reductionFactor = Math.sqrt(1 / sizeRatio); // Raiz quadrada para suavizar
        calculatedQuality = Math.max(
          25,
          Math.round(testQuality * reductionFactor)
        );
      }

      console.log(
        `🎯 Qualidade calculada: ${calculatedQuality}% (baseada na proporção ${sizeRatio.toFixed(
          2
        )}x)`
      );

      // Gera arquivo final com qualidade calculada
      const finalCmd = `ffmpeg -y -i "${inputPath}" \
-vcodec libwebp \
-filter_complex "[0:v] fps=12,crop='min(iw,ih)':'min(iw,ih)',scale=512:512:flags=lanczos,format=rgba" \
-loop 0 -q:v ${Math.round(calculatedQuality * 0.8)} -preset picture -an -vsync 0 -t 5 "${outputPath}"`;

      await new Promise((resolve, reject) => {
        exec(finalCmd, (err, stdout, stderr) => {
          if (err) {
            console.error("❌ Erro no FFmpeg (final):", stderr);
            return reject(err);
          }
          resolve();
        });
      });

      if (!fs.existsSync(outputPath)) {
        throw new Error("Arquivo WebP final não foi gerado pelo FFmpeg");
      }

      const webpBuffer = fs.readFileSync(outputPath);
      const finalSizeKB = Math.round(webpBuffer.length / 1024);

      console.log(
        `📦 WebP final gerado: ${finalSizeKB} KB (qualidade ${calculatedQuality}%)`
      );

      // Verifica se está dentro do limite
      if (webpBuffer.length > 500 * 1024) {
        console.log(
          `⚠️ Ainda grande (${finalSizeKB} KB), tentando qualidade mínima...`
        );

        // Fallback com qualidade mínima
        fs.unlinkSync(outputPath);

        const fallbackCmd = `ffmpeg -y -i "${inputPath}" \
-vcodec libwebp \
-filter_complex "[0:v] fps=10,crop='min(iw,ih)':'min(iw,ih)',scale=512:512:flags=lanczos,format=rgba" \
-loop 0 -q:v 20 \
-preset picture -an -vsync 0 -t 4 "${outputPath}"`;

        await new Promise((resolve, reject) => {
          exec(fallbackCmd, (err, stdout, stderr) => {
            if (err) {
              console.error("❌ Erro no FFmpeg (fallback):", stderr);
              return reject(err);
            }
            resolve();
          });
        });

        const fallbackBuffer = fs.readFileSync(outputPath);
        const fallbackSizeKB = Math.round(fallbackBuffer.length / 1024);

        if (fallbackBuffer.length > 500 * 1024) {
          throw new Error(
            `Não foi possível reduzir para menos de 500KB. Tamanho final: ${fallbackSizeKB} KB`
          );
        }

        console.log(
          `📦 Fallback aplicado: ${fallbackSizeKB} KB (qualidade mínima)`
        );
        const webpB64 = fallbackBuffer.toString("base64");
        const media = new MessageMedia("image/webp", webpB64);

        await client.sendMessage(chatId, media, {
          sendMediaAsSticker: true,
          stickerAuthor: "WPP Bot",
          stickerName: "Sticker Animado",
        });

        console.log(
          `🎉 Sticker animado enviado! (${fallbackSizeKB} KB, qualidade mínima)`
        );
      } else {
        // Sucesso com qualidade calculada
        const webpB64 = webpBuffer.toString("base64");
        const media = new MessageMedia("image/webp", webpB64);

        await client.sendMessage(chatId, media, {
          sendMediaAsSticker: true,
          stickerAuthor: "WPP Bot",
          stickerName: "Sticker Animado",
        });

        console.log(
          `🎉 Sticker animado enviado com sucesso! (${finalSizeKB} KB, qualidade ${calculatedQuality}%)`
        );
      }
    } catch (error) {
      console.error("❌ Erro ao processar sticker animado:", error.message);
      throw error;
    } finally {
    //   if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    //   if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  }

  async _animatedStickerErrorHandler(client, chatId, ext = "") {
    try {
      console.log("Animated sticker error handler");

      const ffmpegAvailable = await this._checkFFmpegAvailability();

      // Envia mensagem de erro para o usuário
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
          "• Vídeo muito longo (limite: 10 segundos)\n" +
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

        // Processa GIF animado diretamente sem chamar sendAnimatedSticker
        // para evitar loop infinito
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

      // Para imagens estáticas
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

      // Determina se é animado (GIF ou vídeo)
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

      // Envia mensagem de erro geral
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
