# 🚀 FinControl — passo a passo completo

Criar a conta Google, criar o projeto Firebase, configurar, personalizar e publicar (deploy).
Feito para Windows/PowerShell. Você já tem instalado: **Node.js v24**, **npm 11**, **git**.

> Pasta do projeto:
> `C:\Users\renan.batista\OneDrive\PROJETOS COMPARTILHADOS\DESPESAS_MENSAIS`

---

## PARTE 0 — Abrir o terminal na pasta do projeto

```powershell
cd "C:\Users\renan.batista\OneDrive\PROJETOS COMPARTILHADOS\DESPESAS_MENSAIS"
```

Dica: dentro da pasta no Explorador, digite `powershell` na barra de endereço e Enter — já abre na pasta certa.

---

## PARTE 1 — Testar o site no seu computador (2 minutos)

```powershell
cd site
python -m http.server 8080
```

Abra <http://localhost:8080> — você verá a tela de login.
Sem Firebase configurado ele roda em **modo local** (tudo fica no navegador). Para voltar, `Ctrl+C`.

> Criar conta → “Criar conta” → preencher → entrar → botão **“Dados de exemplo”** para ver o painel cheio.
> Para testar a sua planilha: aba **Importar / Exportar** → arraste o `Controle_Financeiro_Profissional.xlsx`.

---

## PARTE 2 — Criar a conta Google (se ainda não tiver)

1. Acesse <https://accounts.google.com> → **Criar conta** → *Para uso pessoal* → nome, sobrenome → escolha um `@gmail.com` → senha → telefone (opcional) → **Próximo** → aceitar os termos.
2. Já tem conta Google? Pode usar ela mesmo — não precisa ser Gmail.

---

## PARTE 3 — Criar o projeto no Firebase (5 passos)

1. Acesse <https://console.firebase.google.com> e entre com a conta Google.
2. Clique em **Criar um projeto** (ou *Add project*).
   - Nome do projeto: `FinControl` → **Continuar**
   - Google Analytics: pode desmarcar **“Enable Google Analytics”** → **Criar projeto**
   - Aguarde → **Continuar** (você entra no painel do projeto)
3. Anote o **ID do projeto** (ex.: `fincontrol-3f1a2`):  
   ⚙ **Configurações do projeto** → *Configurações gerais* → **ID do projeto**.  
   Ele é o `SEU_ID_DO_PROJETO_AQUI` do arquivo `.firebaserc`.

### 3.1 Ativar o login por e-mail/senha
4. No menu lateral: **Build → Authentication → Get started**
5. Aba **Sign-in method** → clique em **E-mail/senha** → ligue o botão **Enable** → **Save**
   > Sem isso, o cadastro dá o erro `auth/operation-not-allowed`.

### 3.2 Criar o primeiro usuário (opcional)
6. Aba **Users** → **Add user** → e-mail + senha (mínimo 6 dígitos) → **Add**.  
   *(Também funciona criar direto pela tela “Criar conta” do site depois do deploy.)*

### 3.3 Criar o banco de dados (Firestore)
7. Menu lateral: **Build → Firestore Database → Create database**
8. Escolha **Start in production mode** (é o modo com regras de segurança) → **Next**
9. Região: escolha a mais perto — ex.: `southamerica-east1 (São Paulo)` → **Enable database**
10. Ainda em **Firestore Database → aba Rules**, apague tudo e cole o conteúdo do arquivo
    `firestore.rules` (está nesta pasta) e clique em **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{uid}/{doc=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> Essas regras garantem que **cada usuário só enxerga os próprios lançamentos**.

### 3.4 Criar o “app web” e copiar as chaves
11. ⚙ **Configurações do projeto** → aba **Seus apps** → clique no ícone **`</>` (Web)**
12. Nickname: `FinControl-web` → desmarque *“Also set up Firebase Hosting”* → **Register app**
13. Firebase mostra o bloco `firebaseConfig` — **copie os valores**:
```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "fincontrol-3f1a2.firebaseapp.com",
  projectId: "fincontrol-3f1a2",
  storageBucket: "fincontrol-3f1a2.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```
14. **Continue to console**.

---

## PARTE 4 — Colar as chaves no site

Abra `site/js/config.js` no Bloco de Notas (ou VS Code) e preencha **exatamente** os valores do passo 13:

```js
firebase: {
  apiKey: "AIzaSySEUVALOR_AQUI",
  authDomain: "fincontrol-3f1a2.firebaseapp.com",
  projectId: "fincontrol-3f1a2",
  storageBucket: "fincontrol-3f1a2.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
},
```

> As chaves do Firebase **podem** ficar no código do site — elas não dão acesso aos dados;
> quem acessa é só quem tem login, pelas regras do Firestore.

**Teste de novo localmente** (Parte 1): o selo abaixo do formulário deve dizer
*“Protegido por Firebase Authentication · dados na nuvem”*. Crie sua conta e importe a planilha.

---

## PARTE 5 — Deploy (publicar de graça)

### Opção A — Firebase Hosting (recomendada, mesmo ecossistema)

```powershell
# na pasta do projeto (onde está o firebase.json)
npx firebase-tools login          # abre o navegador e autoriza
npx firebase-tools use SEU_ID_DO_PROJETO_AQUI   # id anotado no passo 3
npx firebase-tools deploy
```

No final aparece:
```
✔  Deploy complete!
Hosting URL: https://SEU_ID_DO_PROJETO.web.app
```
Esse endereço (e o `*.firebaseapp.com`) já é **HTTPS e público**. Use no celular também.

Se preferir instalar a ferramenta globalmente (opcional):
```powershell
npm install -g firebase-tools
firebase login
firebase deploy
```

### Opção B — Netlify (sem terminal, arrastar e soltar)

1. Abra <https://app.netlify.com/drop> em um navegador.
2. Arraste a **pasta `site`** inteira para a área indicada.
3. Pronto — em ~30 s você recebe um endereço `https://qualquer-coisa.netlify.app`.
   (Dá para renomear em *Site settings → Change site name*.)
4. Para atualizar depois: mesmo lugar, ou CLI:
   ```powershell
   npx netlify-cli deploy --dir=site --prod
   ```

### Opção C — Vercel

```powershell
npx vercel            # primeira vez: responda Y, depois N em "link to existing"
                      # confirme a pasta: site (já vem configurado no vercel.json)
npx vercel --prod     # publica em produção
```
Endereço: `https://fincontrol-xxxx.vercel.app`.

### Opção D — Cloudflare Pages

Painel → **Workers & Pages → Create → Pages → Upload assets** → nome do projeto →
selecione a pasta `site` → **Deploy site** → `https://nome.pages.dev`.

### Opção E — GitHub Pages

```powershell
git init
git add .
git commit -m "FinControl v1"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/fincontrol.git
git push -u origin main
```
No GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / pasta `/site`** → Save.

### Domínio próprio (opcional)
Netlify, Vercel, Cloudflare Pages e Firebase Hosting permitem apontar um domínio que você tenha,
com HTTPS automático, sem custo (o domínio em si é pago ~R$ 40/ano, exceto subdomínios gratuitos).

---

## PARTE 6 — Depois do deploy: checklist

1. Abra o endereço público → **Criar conta** com o seu e-mail.
2. **Importar / Exportar** → arraste o `Controle_Financeiro_Profissional.xlsx` → confira a prévia → importar.
3. Veja o painel por mês (seletor no topo), filtre em **Lançamentos**, edite/exclua.
4. **Exportar → JSON** e guarde: é o seu backup.
5. Entre pelo celular para confirmar que os dados aparecem (é a nuvem funcionando).

---

## PARTE 7 — Modificações frequentes

| O que mudar | Onde | Como |
|---|---|---|
| Nome do site / marca | `site/index.html` | troque `FinControl` no `<title>`, no `.brand__name` e no `meta description` |
| Nome usado no código | `site/js/config.js` | propriedade `nome` |
| Logo | `site/assets/favicon.svg` + o SVG dentro de `.brand__mark` no `index.html` | edite o caminho do gráfico |
| Cores da marca | `site/css/styles.css` | em `:root` mude `--brand` e `--brand-grad`; no bloco `[data-theme="dark"]` mude `--brand` |
| Itens por página da tabela | `site/js/config.js` | `porPagina: 15` |
| Limite de importação | `site/js/config.js` | `limiteImportacao: 3000` |
| Categorias padrão de novos usuários | `site/js/store.js` | função `categoriasPadrao()` — nome e cor |
| Moeda / idioma | `site/js/app.js` | função `brl()` (`pt-BR` / `BRL`) |
| Esconder “Dados de exemplo” | `site/index.html` | apague o botão `id="btnCarregarExemplo"` e o `data-exemplo` do cartão de boas-vindas |
| Tela de login sem o texto de exemplo | `site/js/exemplo.js` | vire o array para `[]` |

### Adicionar um campo novo (ex.: “Conta/Cartão”)
1. `site/index.html`, dentro do formulário `#formLanc`:  
   `<label class="field"><span>Conta</span><input name="conta" placeholder="Nubank, Itaú…" maxlength="40"></label>`
2. `site/js/app.js`, na função `salvarLancamento`, inclua no objeto `item`:  
   `conta: f.conta.value.trim(),`
3. `site/js/app.js`, na função `renderTabela`, mostre na célula da descrição:  
   `<small>${esc(l.conta)} · ${esc(l.observacoes)}</small>`
4. (Opcional) em `normalizarItem`, reconheça a coluna da planilha:  
   `conta: String(m["conta"] || "").trim()`  
   Se a planilha não tiver a coluna, o campo fica vazio nos lançamentos importados.

### Subir as alterações
- Firebase: `npx firebase-tools deploy` (só hosting: `--only hosting`)
- Netlify: arraste a pasta de novo no drop **ou** `npx netlify-cli deploy --dir=site --prod`
- Vercel: `npx vercel --prod`

---

## PARTE 8 — Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| `auth/operation-not-allowed` | E-mail/senha não ativado → Authentication → Sign-in method → **Enable** |
| `permission-denied` no Firestore | Regras não publicadas (passo 3.3) ou você está logado com outra conta |
| Tela em branco / nada funciona | `F12` → aba Console. Confira se as chaves do `config.js` foram coladas sem espaços e com aspas |
| Selo ainda diz “Modo local” | Chave `apiKey` vazia ou `modo: "local"` no `config.js` |
| `Firebase indisponível, usando modo local` | Sem internet ou CDN bloqueada; o site continua funcionando offline |
| Dados “sumiram” após trocar de navegador | Estavam no modo local; refaça o login com Firebase configurado |
| Deploy antigo aparecendo | Firebase: `npx firebase-tools deploy` de novo · Netlify: *Clear cache and deploy* · Vercel: `npx vercel --prod` |
| Aviso de índice no Firestore | Clique no link que o erro mostra no console — o Firebase cria o índice sozinho |

---

## Checklist final

- [ ] Conta Google criada
- [ ] Projeto Firebase criado e ID anotado
- [ ] Authentication → E-mail/senha **ativado**
- [ ] Firestore criado em **production** + regras publicadas
- [ ] `firebaseConfig` colado em `site/js/config.js`
- [ ] Teste local com “Modo na nuvem” no selo
- [ ] Deploy feito (Firebase / Netlify / Vercel / Cloudflare)
- [ ] Conta criada no site publicado + planilha importada
- [ ] Backup JSON baixado
