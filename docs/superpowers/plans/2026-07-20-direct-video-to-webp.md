# Plano: Conversão Direta Vídeo → WebP

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, task por task. Passos usam checkboxes (`- [ ]`).

**Objetivo:** Substituir o pipeline vídeo → GIF → WebP (2-3 encodes) por um passe único de FFmpeg (vídeo → WebP), mantendo nosso loop de controle de tamanho.

**Arquitetura:** Adotar a abordagem de passe único do wwebjs (`Util.formatVideoToWebpSticker`), mas mantendo nossas vantagens: arquivos temp em vez de streams, 512x512 nativo a 15fps, e fallback de qualidade em 3 tentativas mirando o limite de 500KB do WhatsApp. Remove `_convertVideoToSticker` e `_sendAnimatedGifSticker` (~250 linhas).

**Stack:** fluent-ffmpeg/exec (já instalado), sharp (já instalado, só na verificação)

## Restrições Globais

- Sem comentários no código (convenção do projeto)
- Commits curtos, sem Co-Authored-By
- Caminho de GIF não muda: continua em `sendStickerFromBase64` (Sharp animado)
- Caminho de imagem estática não muda: pipeline Sharp HD permanece
- Contrato com a lib: sempre enviar `image/webp` com `sendMediaAsSticker: true` (a lib faz passthrough e só embute EXIF)
- Limite do WhatsApp para sticker animado: WebP final ≤ 500 * 1024 bytes

---

### Task 1: Substituir pipeline de vídeo por `_videoToWebp` de passe único

**Arquivos:**
- Modificar: `src/services/StickerService.js` (substituir `_convertVideoToSticker` e `_sendAnimatedGifSticker` por um método; reescrever `sendAnimatedSticker`)

**Interfaces:**
- Consome: `this._checkFFmpegAvailability()` (existente, retorna `Promise<boolean>`), `this._animatedStickerErrorHandler(client, chatId, ext)` (existente)
- Produz: `_videoToWebp(base64Data, ext)` → `Promise<string>` (base64 WebP ≤500KB, lança erro em falha); `sendAnimatedSticker(client, chatId, base64Data, ext)` (assinatura inalterada — `processMedia` não precisa de edição)

- [ ] **Passo 1: Adicionar método `_videoToWebp`**

Adicionar aos requires do topo do arquivo:

```javascript
const os = require("os");
const crypto = require("crypto");
```

Adicionar à classe `StickerService` (após `_getQualitySettings`):

```javascript
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
```

- [ ] **Passo 2: Reescrever `sendAnimatedSticker`**

Substituir o método inteiro por:

```javascript
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
```

- [ ] **Passo 3: Deletar `_convertVideoToSticker` e `_sendAnimatedGifSticker`**

Remover os dois métodos inteiros. Verificar que nada mais os referencia:

```bash
grep -rn "_convertVideoToSticker\|_sendAnimatedGifSticker" src/
```

Esperado: nenhum resultado.

- [ ] **Passo 4: Checagem de sintaxe**

```bash
node -e "require('./src/services/StickerService'); console.log('OK')"
```

Esperado: `OK`

- [ ] **Passo 5: Commit**

```bash
git add src/services/StickerService.js
git commit -m "refactor: conversão de vídeo em passe único"
```

---

### Task 2: Verificação executável

**Arquivos:**
- Criar: `test-video-webp.js` (raiz do repo, deletado após passar)

**Interfaces:**
- Consome: `StickerService._videoToWebp(base64Data, ext)` da Task 1

- [ ] **Passo 1: Escrever script de verificação**

Criar `test-video-webp.js`:

```javascript
const assert = require("assert");
const fs = require("fs");
const { execSync } = require("child_process");
const sharp = require("sharp");
const StickerService = require("./src/services/StickerService");

async function main() {
  execSync(
    "ffmpeg -y -f lavfi -i testsrc=duration=3:size=640x360:rate=30 temp_test.mp4",
    { stdio: "ignore" }
  );

  const b64 = fs.readFileSync("temp_test.mp4").toString("base64");
  const svc = new StickerService();
  const webpB64 = await svc._videoToWebp(b64, "mp4");
  const buffer = Buffer.from(webpB64, "base64");

  assert(buffer.length > 0, "saída vazia");
  assert(buffer.length <= 500 * 1024, `saída grande demais: ${buffer.length}`);

  const meta = await sharp(buffer, { animated: true }).metadata();
  assert.strictEqual(meta.format, "webp");
  assert(meta.pages > 1, "webp não é animado");
  assert.strictEqual(meta.width, 512);

  fs.unlinkSync("temp_test.mp4");
  console.log(`OK: ${Math.round(buffer.length / 1024)}KB, ${meta.pages} frames, 512px`);
}

main().catch((err) => {
  console.error("FALHOU:", err.message);
  process.exit(1);
});
```

- [ ] **Passo 2: Rodar**

```bash
node test-video-webp.js
```

Esperado: `OK: <n>KB, <n> frames, 512px`

- [ ] **Passo 3: Deletar o script**

```bash
rm test-video-webp.js
```

- [ ] **Passo 4: Verificar árvore limpa e sem arquivos temp sobrando**

```bash
git status --short && ls temp/ 2>/dev/null
```

Esperado: status vazio, diretório temp vazio ou inexistente.

---

### Task 3: Atualizar README

**Arquivos:**
- Modificar: `README.md` (linha do diagrama de arquitetura e seção de vídeo)

**Interfaces:**
- Consome: nada
- Produz: docs alinhadas ao novo pipeline

- [ ] **Passo 1: Atualizar linha do diagrama**

Na caixa do `StickerService`, trocar:

```
│ • FFmpeg: vídeo → GIF → WebP                                │
```

por:

```
│ • FFmpeg: vídeo → WebP (passe único)                        │
```

- [ ] **Passo 2: Atualizar seção de vídeo**

Trocar:

```markdown
### Vídeo (MP4, WebM, AVI, MOV)
1. Converte para GIF (FFmpeg, limite 5s)
2. Redimensiona para 512x512, 15 FPS
3. Converte para WebP animado
4. Envia como sticker animado
```

por:

```markdown
### Vídeo (MP4, WebM, AVI, MOV)
1. Converte direto para WebP animado (FFmpeg, passe único, limite 5s)
2. 512x512, 15 FPS, com fallback de qualidade para ficar ≤ 500KB
3. Envia como sticker animado
```

- [ ] **Passo 3: Atualizar seção de performance**

Trocar `- Vídeo → Sticker: ~5-15s (depende de duração/qualidade)` por `- Vídeo → Sticker: ~3-8s (passe único FFmpeg)`.

- [ ] **Passo 4: Commit e push**

```bash
git add README.md
git commit -m "docs: pipeline de conversão em passe único"
git push origin main
```

---

## O que mantemos de propósito (NÃO substituir pelo código do wwebjs)

- **Pipeline Sharp de imagem estática** — a lib delega ao browser sem controle de qualidade/tamanho; o nosso é o diferencial "HD" do bot.
- **Loop de controle de tamanho** — a lib não checa o tamanho da saída; WebP grande é rejeitado pelo WhatsApp silenciosamente.
- **Arquivos temp em vez de streams** — o input por stream deles é falha conhecida com MP4 (moov atom no fim).
- **Metadata EXIF do sticker** — já é feita pela lib no envio (`stickerName`/`stickerAuthor`); nenhum trabalho necessário.
