const { MessageMedia } = require("whatsapp-web.js");
const sharp = require("sharp");

class StickerService {
  /**
   * Obtém configurações de qualidade baseadas no número de frames
   */
  _getQualitySettings(pages) {
    if (pages > 100) return { quality: 30, effort: 4, alphaQuality: 40 };
    if (pages > 50) return { quality: 45, effort: 5, alphaQuality: 50 };
    return { quality: 60, effort: 6, alphaQuality: 80 };
  }

  /**
   * Converte GIF/Video para WebP animado com otimização
   */
  async _convertAnimatedToWebp(input, metadata, ext) {
    // Para vídeos, extrai apenas alguns frames se for muito longo
    const maxFrames = ext === 'gif' ? metadata.pages : Math.min(metadata.pages || 30, 50);
    const settings = this._getQualitySettings(maxFrames);
    
    let sharpOptions = { animated: true, limitInputPixels: false };
    
    // Para vídeos, pode precisar de configurações especiais
    if (ext !== 'gif') {
      sharpOptions.pages = maxFrames; // Limita frames para vídeos
    }
    
    const optimizedWebp = await sharp(input, sharpOptions)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: false, kernel: sharp.kernel.nearest })
      .webp({ ...settings, lossless: false, nearLossless: false, smartSubsample: true, reductionEffort: 6, mixed: false })
      .toBuffer();
    
    console.log(`WebP animado gerado: ${optimizedWebp.length} bytes com ${maxFrames} frames preservados`);
    
    // Aplica compressão extrema se necessário
    if (optimizedWebp.length > 800000 && maxFrames > 50) {
      console.log('Arquivo ainda muito grande, aplicando compressão extrema...');
      
      const finalWebp = await sharp(input, sharpOptions)
        .resize(256, 256, { fit: 'inside', withoutEnlargement: false, kernel: sharp.kernel.nearest })
        .webp({ quality: 10, effort: 2, lossless: false, nearLossless: false, smartSubsample: false, alphaQuality: 20, reductionEffort: 6 })
        .toBuffer();
        
      console.log(`Compressão extrema aplicada: ${finalWebp.length} bytes`);
      return finalWebp;
    }
    
    return optimizedWebp;
  }

  /**
   * Converte imagem estática para WebP
   */
  async _convertStaticToWebp(input) {
    return sharp(input)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: false, kernel: sharp.kernel.lanczos3, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90, effort: 6, alphaQuality: 95 })
      .toBuffer();
  }

  /**
   * Envia sticker animado otimizado (GIF, MP4, WebM, etc.)
   */
  async sendAnimatedSticker(client, chatId, base64Data, ext) {
    try {
      console.log(`Processando ${ext} animado com Sharp...`);
      
      const input = Buffer.from(base64Data, 'base64');
      const metadata = await sharp(input).metadata();
      
      console.log(`Mídia animada: ${metadata.width}x${metadata.height}, páginas: ${metadata.pages || 1}, formato: ${ext}`);
      
      let webpBuffer, stickerName;
      
      // Verifica se tem múltiplos frames (animado)
      const isAnimated = (ext === 'gif' && metadata.pages > 1) || 
                        (ext !== 'gif' && (ext === 'mp4' || ext === 'webm' || ext === 'video'));
      
      if (isAnimated) {
        const frameCount = metadata.pages || 30; // Assume 30 frames para vídeos sem metadata
        console.log(`${ext.toUpperCase()} com ${frameCount} frames - convertendo para WebP animado...`);
        webpBuffer = await this._convertAnimatedToWebp(input, metadata, ext);
        stickerName = `Sticker ${ext.toUpperCase()} (${frameCount}f)`;
        console.log(`Sticker WebP animado enviado com ${frameCount} frames completos!`);
      } else {
        // Fallback para imagem estática
        webpBuffer = await this._convertStaticToWebp(input);
        stickerName = `Sticker ${ext.toUpperCase()}`;
        console.log('Sticker convertido enviado com sucesso!');
      }
      
      const optimizedBase64 = webpBuffer.toString('base64');
      const media = new MessageMedia('image/webp', optimizedBase64);
      
      await client.sendMessage(chatId, media, {
        sendMediaAsSticker: true,
        stickerAuthor: 'WPP Finance Bot',
        stickerName
      });
      
    } catch (error) {
      console.error(`Erro ao processar sticker ${ext}:`, error);
      await this._fallbackToStatic(client, chatId, base64Data);
    }
  }

  /**
   * Fallback para processamento estático
   */
  async _fallbackToStatic(client, chatId, base64Data) {
    try {
      console.log('Tentando fallback para imagem estática...');
      await this.sendStickerFromBase64(client, chatId, base64Data);
    } catch (fallbackError) {
      console.error('Erro no fallback:', fallbackError);
    }
  }

  /**
   * Converte base64 para WebP otimizado
   */
  async base64ToStickerWebp(b64) {
    const input = Buffer.from(b64, 'base64');
    const metadata = await sharp(input).metadata();
    const { width, height } = metadata;
    
    // Calcula dimensões otimizadas (máximo 512x512)
    const maxSize = 512;
    const ratio = Math.min(maxSize / width, maxSize / height);
    const newWidth = Math.round(width * ratio);
    const newHeight = Math.round(height * ratio);

    let pipeline = sharp(input);
    
    // Aplica sharpening para imagens pequenas
    if (width < 256 || height < 256) {
      pipeline = pipeline.sharpen({ sigma: 0.5, m1: 0.5, m2: 2.0, x1: 2, y2: 10, y3: 20 });
    }

    // Otimização iterativa da qualidade
    for (let q = 95; q >= 60; q -= 2) {
      const out = await pipeline
        .resize(newWidth, newHeight, { kernel: sharp.kernel.lanczos3, fit: 'inside', withoutEnlargement: false })
        .extend({
          top: Math.floor((maxSize - newHeight) / 2),
          bottom: Math.ceil((maxSize - newHeight) / 2),
          left: Math.floor((maxSize - newWidth) / 2),
          right: Math.ceil((maxSize - newWidth) / 2),
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({
          quality: q,
          lossless: false,
          nearLossless: q > 85,
          effort: 6,
          smartSubsample: true,
          alphaQuality: Math.min(q + 5, 100),
          mixed: true
        })
        .toBuffer();

      if (out.byteLength <= 90_000) return out.toString('base64');
    }
  }

  /**
   * Otimiza imagem baseada no formato
   */
  async _optimizeByFormat(input, format) {
    const formatHandlers = {
      jpeg: () => sharp(input).median(1).sharpen({ sigma: 1, m1: 0.5, m2: 2, x1: 2, y2: 10, y3: 20 }).jpeg({ quality: 95 }).toBuffer(),
      jpg: () => sharp(input).median(1).sharpen({ sigma: 1, m1: 0.5, m2: 2, x1: 2, y2: 10, y3: 20 }).jpeg({ quality: 95 }).toBuffer(),
      png: () => sharp(input).png({ compressionLevel: 0, quality: 100 }).toBuffer(),
      gif: () => sharp(input).png({ compressionLevel: 0, quality: 100 }).toBuffer(),
      default: () => sharp(input).png({ compressionLevel: 0, quality: 100 }).toBuffer()
    };
    
    const handler = formatHandlers[format] || formatHandlers.default;
    return handler();
  }

  /**
   * Processa e envia sticker de base64
   */
  async sendStickerFromBase64(client, chatId, base64Data) {
    try {
      const input = Buffer.from(base64Data, 'base64');
      const metadata = await sharp(input).metadata();
      
      console.log(`Processando imagem: ${metadata.width}x${metadata.height}, formato: ${metadata.format}`);
      
      // Verifica se é GIF animado
      if (metadata.format === 'gif' && metadata.pages > 1) {
        console.log('Detectado GIF animado, convertendo para WebP animado...');
        await this.sendAnimatedSticker(client, chatId, base64Data, 'gif');
        return;
      }
      
      // Otimiza baseado no formato
      const enhanced = await this._optimizeByFormat(input, metadata.format);
      const webpB64 = await this.base64ToStickerWebp(enhanced.toString('base64'));
      
      const media = new MessageMedia('image/webp', webpB64);
      await client.sendMessage(chatId, media, {
        sendMediaAsSticker: true,
        stickerAuthor: 'WPP Finance Bot',
        stickerName: 'Figurinha HD'
      });
      
      console.log('Sticker HD enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao processar sticker:', error);
    }
  }

  /**
   * Determina o tipo de extensão da mídia animada
   */
  _getMediaExtension(mimetype) {
    if (mimetype.includes('gif')) return 'gif';
    if (mimetype.includes('mp4')) return 'mp4';
    if (mimetype.includes('webm')) return 'webm';
    if (mimetype.includes('avi')) return 'avi';
    if (mimetype.includes('mov')) return 'mov';
    if (mimetype.includes('mkv')) return 'mkv';
    if (mimetype.includes('flv')) return 'flv';
    if (mimetype.includes('wmv')) return 'wmv';
    return 'video';
  }

  /**
   * Processa mídia recebida e determina o tipo de processamento
   */
  async processMedia(client, media, chatId) {
    try {
      if (!media || (!media.mimetype.startsWith('image/') && !media.mimetype.startsWith('video/'))) {
        console.log("Mídia não é suportada. Tipos aceitos: imagens (PNG, JPEG, GIF) e vídeos (MP4, WebM, AVI, MOV, etc.)");
        console.log(`Tipo recebido: ${media ? media.mimetype : 'desconhecido'}`);
        return;
      }

      console.log(`Mídia recebida: ${media.mimetype}, tamanho: ${media.data.length} chars`);
      
      // Detecta e processa diferentes tipos de mídia
      if (media.mimetype === 'image/gif' || media.mimetype.startsWith('video/')) {
        const ext = this._getMediaExtension(media.mimetype);
        console.log(`${ext.toUpperCase()} detectado, processando como animado...`);
        await this.sendAnimatedSticker(client, chatId, media.data, ext);
      } else {
        console.log('Imagem estática detectada');
        await this.sendStickerFromBase64(client, chatId, media.data);
      }
      
    } catch (error) {
      console.error("Erro ao processar mídia:", error);
    }
  }
}

module.exports = StickerService;
