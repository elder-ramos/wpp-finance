# WPP Sticker Bot

Um bot WhatsApp que converte imagens, GIFs e vídeos em stickers animados, com processamento em fila para lidar com múltiplas requisições em paralelo.

## Features

- 📸 **Imagens** → Stickers (JPG, PNG, WebP)
- 🎬 **Vídeos** → Stickers Animados (MP4, WebM, AVI, MOV)
- 🎞️ **GIFs** → Stickers Animados
- 📊 **Processamento em Fila** - Até 3 conversões paralelas
- 📱 **Feedback em Tempo Real** - Usuário recebe posição na fila

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│ WhatsApp Client (whatsapp-web.js)                           │
└──────────────────────┬──────────────────────────────────────┘
                       │ msg.on("message")
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ Message Handler (index.js)                                   │
│ • Enfileira processamento                                    │
│ • Envia feedback imediato com posição na fila               │
└──────────────────────┬──────────────────────────────────────┘
                       │ stickerQueue.enqueue()
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ StickerQueue (p-queue, concurrency=3)                        │
│ • Gerencia até 3 processamentos paralelos                    │
└──────────────────────┬──────────────────────────────────────┘
                       │ jobFn (async)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ StickerService (services/StickerService.js)                 │
│ • Detecta tipo de mídia (imagem/GIF/vídeo)                  │
│ • FFmpeg: vídeo → WebP (passe único)                        │
│ • Sharp: processamento de imagens                           │
│ • Envia sticker via WhatsApp API                            │
└──────────────────────────────────────────────────────────────┘
```

## Setup

### Pré-requisitos

- Node.js v16+
- FFmpeg (para conversão de vídeos) — opcional, GIFs e imagens funcionam sem
- WhatsApp Mobile (para autenticação)

### Instalação

```bash
# Clonar e instalar
git clone <repo>
cd wpp-finance
npm install

# Iniciar bot
npm start
```

Scaneie o QR code com seu WhatsApp mobile para autenticar.

## Processamento de Mídia

### Imagem Estática (JPG, PNG)
1. Redimensiona para 512x512
2. Converte para WebP com qualidade ajustada
3. Envia como sticker

### GIF Animado
1. Converte para WebP animado com p-queue (até 3 paralelos)
2. Reduz qualidade se arquivo > 500KB
3. Envia como sticker animado

### Vídeo (MP4, WebM, AVI, MOV)
1. Converte direto para WebP animado (FFmpeg, passe único, limite 5s)
2. 512x512, 15 FPS, com fallback de qualidade para ficar ≤ 500KB
3. Envia como sticker animado

## Fila de Processamento

**Novo em v2.0:** Processamento em fila com p-queue

- **Concorrência:** Até 3 stickers processados simultaneamente
- **Feedback:** Usuário recebe mensagem imediata com posição na fila
- **Sem bloqueio:** Bot responde outras mensagens enquanto processa

**Exemplo:**
```
1️⃣ User A: Enviar foto
   → Bot: "⏳ Processando seu sticker..."

2️⃣ User B: Enviar vídeo (1s depois)
   → Bot: "⏳ Seu sticker está na fila! Posição: 2"

3️⃣ User C: Enviar GIF (1s depois)
   → Bot: "⏳ Seu sticker está na fila! Posição: 3"

[Após ~3-5s, User A recebe sticker]
[User B e C continuam na fila, posições atualizadas]
```

## Retry de Download

Implementa 3 tentativas automáticas ao baixar mídia do WhatsApp, com delay de 1s entre tentativas.

## Erros Comuns

### "FFmpeg não disponível"
- GIFs e imagens funcionam perfeitamente
- Vídeos geram aviso, mas não causam erro
- Instale FFmpeg se quiser converter vídeos: `choco install ffmpeg` (Windows) ou `brew install ffmpeg` (macOS)

### "Arquivo muito grande (> 500KB)"
- Bot aplica compressão automática
- Se ainda > 500KB após compressão, retorna erro
- Tente com arquivo menor ou GIF com menos frames

### "addAnnotations error"
- WhatsApp Web foi atualizado
- Bot precisa de atualização de dependências
- Execute: `npm install`

## Desenvolvimento

### Estrutura de Arquivos

```
src/
├── index.js                    # Bot principal, handler de mensagens
├── services/
│   ├── index.js               # Exports
│   └── StickerService.js       # Lógica de conversão
└── queue/
    └── StickerQueue.js         # Gerenciador de fila (p-queue)
```

### Estender o Bot

**Adicionar novo comando:**
```javascript
client.on("message", async (msg) => {
  if (msg.body === "!ping") {
    await client.sendMessage(msg.from, "Pong!");
  }
});
```

**Customizar limite de concorrência:**
```javascript
const stickerQueue = new StickerQueue(5); // Até 5 paralelos
```

## Stack Técnico

- **whatsapp-web.js** — Client WhatsApp Web
- **express** — API HTTP (endpoints futuros)
- **sharp** — Processamento de imagens
- **FFmpeg** (binário externo, via `child_process`) — Conversão de vídeos
- **p-queue** — Gerenciamento de fila com concorrência
- **dotenv** — Variáveis de ambiente

## Performance

- Imagem → Sticker: ~500ms
- GIF → Sticker: ~1-2s
- Vídeo → Sticker: ~3-8s (passe único FFmpeg)
- Fila: Reduz timeouts e sobrecarga sob carga alta

## Licença

ISC
