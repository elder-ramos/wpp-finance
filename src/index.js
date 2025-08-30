const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const sharp = require("sharp");

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
    
    // Aplica pré-processamento baseado no tipo de imagem
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
  // Verifica se a mensagem tem mídia e se é uma imagem
  if (msg.hasMedia) {
    try {
      console.log("Baixando mídia de alta qualidade...");
      
      // Baixa a mídia usando o método oficial (mantém qualidade original)
      const media = await msg.downloadMedia();
      
      if (media && media.mimetype.startsWith('image/')) {
        console.log(`Mídia recebida: ${media.mimetype}, tamanho: ${media.data.length} chars`);
        
        // Usa o método otimizado para processar a imagem
        await sendStickerFromBase64(client, msg.from, media.data);
      } else {
        console.log("Mídia não é uma imagem suportada");
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
