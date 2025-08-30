const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const sharp = require("sharp");

async function sendAnimatedSticker(client, chatId, base64Data, ext) {
  try {
    console.log(`Processando ${ext} animado com Sharp...`);
    
    const input = Buffer.from(base64Data, 'base64');
    const metadata = await sharp(input).metadata();
    
    console.log(`Mídia animada: ${metadata.width}x${metadata.height}, páginas: ${metadata.pages || 1}`);
    
    if (ext === 'gif' && metadata.pages > 1) {
      console.log(`GIF com ${metadata.pages} páginas - convertendo para WebP animado...`);
      
      let quality = 60;
      let effort = 6;
      let alphaQuality = 80;
      
      if (metadata.pages > 100) {
        quality = 30;
        effort = 4;
        alphaQuality = 40;
      } else if (metadata.pages > 50) {
        quality = 45;
        effort = 5;
        alphaQuality = 50;
      }
      
      // Converte para WebP animado com configurações ultra-otimizadas
      const optimizedWebp = await sharp(input, { 
        animated: true,
        limitInputPixels: false
      })
        .resize(512, 512, {
          fit: 'inside',
          withoutEnlargement: false,
          kernel: sharp.kernel.nearest
        })
        .webp({
          quality: quality,
          effort: effort,
          lossless: false,
          nearLossless: false,
          smartSubsample: true,
          alphaQuality: alphaQuality,
          reductionEffort: 6,
          mixed: false
        })
        .toBuffer();
      
      console.log(`WebP animado gerado: ${optimizedWebp.length} bytes com ${metadata.pages} frames preservados`);
      
      let finalWebp = optimizedWebp;
      if (optimizedWebp.length > 800000 && metadata.pages > 50) { // 800KB
        console.log('Arquivo ainda muito grande, aplicando compressão extrema...');
        
        finalWebp = await sharp(input, { 
          animated: true,
          limitInputPixels: false
        })
          .resize(256, 256, {
            fit: 'inside',
            withoutEnlargement: false,
            kernel: sharp.kernel.nearest
          })
          .webp({
            quality: 10,
            effort: 2,
            lossless: false,
            nearLossless: false,
            smartSubsample: false,
            alphaQuality: 20,
            reductionEffort: 6
          })
          .toBuffer();
          
        console.log(`Compressão extrema aplicada: ${finalWebp.length} bytes`);
      }
      
      const optimizedBase64 = finalWebp.toString('base64');
      const media = new MessageMedia('image/webp', optimizedBase64);
      
      await client.sendMessage(chatId, media, {
        sendMediaAsSticker: true,
        stickerAuthor: 'WPP Finance Bot',
        stickerName: `Sticker Completo (${metadata.pages}f)`
      });
      
      console.log(`Sticker WebP animado enviado com ${metadata.pages} frames completos!`);
    } else {
      const webpBuffer = await sharp(input)
        .resize(512, 512, {
          fit: 'inside',
          withoutEnlargement: false,
          kernel: sharp.kernel.lanczos3,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({
          quality: 90,
          effort: 6,
          alphaQuality: 95
        })
        .toBuffer();
      
      const webpBase64 = webpBuffer.toString('base64');
      const media = new MessageMedia('image/webp', webpBase64);
      
      await client.sendMessage(chatId, media, {
        sendMediaAsSticker: true,
        stickerAuthor: 'WPP Finance Bot',
        stickerName: 'Sticker Animado'
      });
      
      console.log('Sticker convertido enviado com sucesso!');
    }
  } catch (error) {
    console.error('Erro ao processar sticker animado:', error);
    
    try {
      console.log('Tentando fallback para imagem estática...');
      await sendStickerFromBase64(client, chatId, base64Data);
    } catch (fallbackError) {
      console.error('Erro no fallback:', fallbackError);
    }
  }
}

// Função para enviar sticker com qualidade máxima otimizada
async function base64ToStickerWebp(b64) {
  const input = Buffer.from(b64, 'base64');
  
  // Primeiro, detecta as dimensões originais para otimizar o redimensionamento
  const metadata = await sharp(input).metadata();
  const { width, height } = metadata;
  
  // Calcula o melhor tamanho mantendo a proporção (máximo 512x512)
  const maxSize = 512;
  const ratio = Math.min(maxSize / width, maxSize / height);
  const newWidth = Math.round(width * ratio);
  const newHeight = Math.round(height * ratio);

  // Aplica sharpening e otimizações antes do redimensionamento se necessário
  let pipeline = sharp(input);
  
  // Se a imagem for muito pequena, aplica interpolação de alta qualidade
  if (width < 256 || height < 256) {
    pipeline = pipeline.sharpen({ sigma: 0.5, m1: 0.5, m2: 2.0, x1: 2, y2: 10, y3: 20 });
  }

  // gera com tamanho otimizado e fundo transparente
  // reduz a qualidade em steps menores para mais precisão
  let q = 95; // começa mais alto
  let out;
  
  for (; q >= 60; q -= 2) { // steps menores para melhor controle
    out = await pipeline
      .resize(newWidth, newHeight, {
        kernel: sharp.kernel.lanczos3,    // melhor kernel para redimensionamento
        fit: 'inside',
        withoutEnlargement: false,
      })
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
        nearLossless: q > 85,     // usa nearLossless apenas em qualidades altas
        effort: 6,                // máximo esforço de compressão
        smartSubsample: true,     // subsampling inteligente
        alphaQuality: Math.min(q + 5, 100), // qualidade alpha ligeiramente maior
        mixed: true,              // permite misturar lossless/lossy por região
      })
      .toBuffer();

    // Margem mais conservadora para evitar recompressão
    if (out.byteLength <= 90_000) break;
  }

  return out.toString('base64');
}

async function sendStickerFromBase64(client, chatId, base64Data) {
  try {
    // Detecta o tipo de imagem e otimiza
    const input = Buffer.from(base64Data, 'base64');
    const metadata = await sharp(input).metadata();
    
    console.log(`Processando imagem: ${metadata.width}x${metadata.height}, formato: ${metadata.format}`);
    
    // Verifica se é um GIF animado
    if (metadata.format === 'gif' && metadata.pages > 1) {
      console.log('Detectado GIF animado, convertendo para WebP animado...');
      await sendAnimatedSticker(client, chatId, base64Data, 'gif');
      return;
    }
    
    // Para imagens estáticas, aplica pré-processamento baseado no tipo
    let optimizedBase64;
    
    if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
      // Para JPEG, remove ruído e melhora nitidez
      const enhanced = await sharp(input)
        .median(1) // remove ruído suave
        .sharpen({ sigma: 1, m1: 0.5, m2: 2, x1: 2, y2: 10, y3: 20 })
        .jpeg({ quality: 95 })
        .toBuffer();
      optimizedBase64 = enhanced.toString('base64');
    } else if (metadata.format === 'png') {
      // Para PNG, preserva transparência e otimiza
      const enhanced = await sharp(input)
        .png({ compressionLevel: 0, quality: 100 })
        .toBuffer();
      optimizedBase64 = enhanced.toString('base64');
    } else if (metadata.format === 'gif') {
      // Para GIF estático, converte para PNG
      const enhanced = await sharp(input)
        .png({ compressionLevel: 0, quality: 100 })
        .toBuffer();
      optimizedBase64 = enhanced.toString('base64');
    } else {
      // Para outros formatos, converte para PNG de alta qualidade
      const enhanced = await sharp(input)
        .png({ compressionLevel: 0, quality: 100 })
        .toBuffer();
      optimizedBase64 = enhanced.toString('base64');
    }
    
    const webpB64 = await base64ToStickerWebp(optimizedBase64);
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
      
      if (media && (media.mimetype.startsWith('image/') || media.mimetype.startsWith('video/'))) {
        console.log(`Mídia recebida: ${media.mimetype}, tamanho: ${media.data.length} chars`);
        
        // Detecta diferentes tipos de mídia
        if (media.mimetype === 'image/gif') {
          console.log('GIF detectado, processando como animado...');
          await sendAnimatedSticker(client, msg.from, media.data, 'gif');
          return;
        } else if (media.mimetype.startsWith('video/')) {
          console.log('Vídeo detectado, será convertido para sticker');
          // Para vídeos, tenta processar como animação
          const ext = media.mimetype.includes('mp4') ? 'mp4' : 
                     media.mimetype.includes('gif') ? 'gif' : 'video';
          await sendAnimatedSticker(client, msg.from, media.data, ext);
          return;
        } else {
          console.log('Imagem estática detectada');
        }
        
        // Usa o método otimizado para processar a imagem/GIF
        await sendStickerFromBase64(client, msg.from, media.data);
      } else {
        console.log("Mídia não é suportada. Tipos aceitos: imagens (PNG, JPEG, GIF) e vídeos");
        console.log(`Tipo recebido: ${media ? media.mimetype : 'desconhecido'}`);
      }
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
