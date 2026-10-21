# 📖 RM_Controle_Financeiro — Documentação Técnica e de Manutenção

> **Versão 1.0** · 21/10/2026
> Projeto Firebase: `rm-controle-financeiro-a8d83` (“RM Controle Financeiro”)
> **Produção:** <https://rm-controle-financeiro-a8d83.web.app>
> Documentos relacionados: [`LEIA-ME.md`](LEIA-ME.md) (uso geral) · [`DEPLOY-PASSO-A-PASSO.md`](DEPLOY-PASSO-A-PASSO.md) (criar projeto do zero)

---

## Índice

1. [O que é o sistema](#1-o-que-é-o-sistema)
2. [Situação atual — ambiente em produção](#2-situação-atual--ambiente-em-produção)
3. [Custos — o sistema gera algum custo?](#3-custos--o-sistema-gera-algum-custo)
4. [Onde os dados ficam armazenados](#4-onde-os-dados-ficam-armazenados)
5. [Mapa do projeto (arquivo por arquivo)](#5-mapa-do-projeto-arquivo-por-arquivo)
6. [Deploy — publicar, atualizar, voltar atrás](#6-deploy--publicar-atualizar-voltar-atrás)
7. [Manutenção de rotina](#7-manutenção-de-rotina)
8. [Segurança](#8-segurança)
9. [Roadmap — melhorias futuras](#9-roadmap--melhorias-futuras)
10. [Solução de problemas](#10-solução-de-problemas)
11. [Referência rápida de comandos](#11-referência-rápida-de-comandos)
12. [Registro de versões (changelog)](#12-registro-de-versões-changelog)

---

## 1. O que é o sistema

Aplicação web **gratuita** de controle financeiro pessoal mensal (receitas, despesas, saldo,
taxa de poupança), construída a partir da planilha
`Controle_Financeiro_Profissional.xlsx`.

| Característica | Detalhe |
|---|---|
| Tipo | SPA estática (Single Page Application) — **sem etapa de build** |
| Front-end | HTML + CSS + JavaScript puros (ES5 compatível), sem framework |
| Login | Firebase Authentication (e-mail + senha) |
| Banco de dados | Cloud Firestore (nuvem), com **dados separados por usuário** |
| Hospedagem | Firebase Hosting (gratuita) |
| Gráficos | Chart.js (carregado sob demanda) com *fallback* em canvas puro |
| Importação | SheetJS lê o `.xlsx` **dentro do navegador** (nunca sobe para a internet) |
| Idioma/moeda | pt-BR / R$ |

### 1.1 Arquitetura

```
┌─────────────────── NAVEGADOR DO USUÁRIO ───────────────────┐
│  index.html + css/styles.css                              │
│  js/app.js      → telas, filtros, gráficos, importação    │
│  js/store.js    → camada de dados (firebase OU local)     │
│  js/config.js   → chaves do Firebase (modo automático)    │
│  js/charts.js   → Chart.js + fallback canvas              │
│  js/exemplo.js  → dados sintéticos de demonstração        │
│                                                            │
│  Planilha .xlsx ──(SheetJS)──> lida localmente, nunca sai │
└───────────────┬───────────────────────────┬───────────────┘
                │ (só se houver chaves no config.js)
                ▼                           ▼
     ┌─────────────────────┐     ┌──────────────────────┐
     │  Firebase Auth      │     │  Cloud Firestore     │
     │  e-mail/senha       │     │  usuarios/{uid}/...  │
     │  (50 mil MAU grátis)│     │  (isolado por usuário)│
     └─────────────────────┘     └──────────────────────┘
                ▲
                │ deploy dos arquivos estáticos
     ┌─────────────────────┐
     │  Firebase Hosting   │  https://rm-controle-financeiro-a8d83.web.app
     └─────────────────────┘
```

### 1.2 Modo de funcionamento do login (importante)

`site/js/config.js` tem `modo: "auto"`:

* **Chaves do Firebase preenchidas** → modo **firebase** (nuvem). É o estado atual.
* **Chaves vazias ou `modo:"local"`** → modo **local**: contas e dados ficam só no
  `localStorage` do navegador (ideal para testar sem internet/sem Firebase).
* Se o Firebase falhar no carregamento (CDN bloqueada, sem internet), o sistema
  **não quebra**: cai automaticamente para o modo local e avisa no console.

O selo abaixo do formulário de login indica qual modo está ativo.

### 1.3 Dependências externas (versões fixadas no código)

| Biblioteca | Versão | Onde é carregada | Uso |
|---|---|---|---|
| Firebase compat SDK | **10.12.5** | `gstatic.com` (lazy, só no login) | Auth + Firestore |
| Chart.js | **4.4.3** | `cdn.jsdelivr.net` (lazy) | gráficos |
| SheetJS (xlsx) | **0.20.3** | `cdn.sheetjs.com` (lazy, só na importação) | ler planilha |
| Google Fonts “Plus Jakarta Sans” | — | `fonts.googleapis.com` | tipografia (tem fallback) |

> Tudo é carregado sob demanda. Se as CDNs caírem, o site continua abrindo; apenas
> gráficos/importação avançada podem ficar limitados (há fallback).

---

## 2. Situação atual — ambiente em produção

*Verificado e testado em 21/10/2026.*

| Item | Valor |
|---|---|
| URL pública | <https://rm-controle-financeiro-a8d83.web.app> (alias: `…firebaseapp.com`) |
| Projeto Firebase | ID `rm-controle-financeiro-a8d83` · nome “RM Controle Financeiro” · nº `577296865629` |
| App web cadastrado | `RM_Controle_Financeiro` · App ID `1:577296865629:web:139ce4ac145781189eb0b4` |
| Conta Google dona do projeto | `themarine100328@gmail.com` |
| Login da CLI nesta máquina | `npx firebase-tools login` → autorizado para a conta acima |
| Firebase Auth (e-mail/senha) | ✅ ativo (comprovado por cadastro real) |
| Cloud Firestore | ✅ ativo (comprovado: gravou, recarregou e o dado permaneceu) |
| Reglas de segurança | ✅ publicadas (`firestore.rules` — isolamento por usuário) |
| Firebase Hosting | ✅ no ar (9 arquivos publicados) |
| Firestore indexes | ✅ `firestore.indexes.json` válido (sem índices compostos — nenhum necessário hoje) |

### 2.1 O que foi testado ponta a ponta (21/10/2026)

- [x] Site abre em produção e exibe “Protegido por Firebase Authentication · dados na nuvem”
- [x] Cadastro de conta novo (`createUserWithEmailAndPassword` → OK)
- [x] Painel abre com o usuário logado
- [x] Criação de lançamento → gravou no Firestore
- [x] **Reload completo da página → o lançamento continuou** (persistência em nuvem comprovada)
- [x] Seed automático das 8 categorias padrão no cadastro
- [x] Regras impedem leitura de dados de outros usuários (padrão `allow read/write` só com `uid` correspondente)
- [x] Importação da planilha real no modo local: 81 de 82 linhas válidas (linha com R$ 0,00 é rejeitada por regra de negócio)
- [x] Lighthouse (testes locais): Acessibilidade 1.0 · Boas Práticas 1.0 · SEO 1.0

### 2.2 Conta de teste existente

| Campo | Valor |
|---|---|
| E-mail | `teste.deploy@exemplo.com` |
| Senha | `123456` |
| Conteúdo | 1 lançamento de exemplo (Alimentação, −R$ 123,45) + 8 categorias |

**Para remover:** console Firebase → **Authentication → Users** → selecione o usuário →
*Delete user*. Os dados vão junto se apagar também em
**Firestore → coleção `usuarios` → doc com o `uid` do usuário → Delete** (ou deixe como
conta de demonstração).

> ⚠️ Crie a sua conta real pelo próprio site (botão “Criar conta”) com um e-mail seu e
> senha forte. A conta de teste é apenas para demonstração.

---

## 3. Custos — o sistema gera algum custo?

### 3.1 Resposta direta

**Não. O custo atual é R$ 0,00.** O projeto está no **plano Spark (no-cost)** do Firebase.
Não é necessário cadastrar cartão de crédito e **não existe fatura automática por excedente
sem faturamento ativado**.

### 3.2 Cotas gratuitas (plano Spark) e o quanto isso representa para este sistema

| Serviço | Cota gratuita | Uso real deste sistema |
|---|---|---|
| **Firebase Hosting** | 10 GB de arquivos · **360 MB/dia** de transferência · HTTPS + CDN | site com ~9 arquivos, < 2 MB; dezenas de visitas/dia = folga enorme |
| **Cloud Firestore** | **1 GiB** armazenado · **50.000 leituras/dia** · **20.000 escritas/dia** · 20.000 exclusões/dia · 10 GiB/mês de saída | 82 lançamentos + 8 categorias + 1 perfil ≈ **~30 KB** (≈0,003% do limite) |
| **Firebase Authentication** | e-mail/senha, social e anônimo **grátis até 50.000 usuários ativos/mês** | 1–10 usuários |
| HTTPS, CDN, certificado TLS | grátis | — |

**Conta de pálco (leitura) para 1 pessoa usar o app:**
cada abertura do painel lê a lista de lançamentos uma vez (≈ 90 documentos com a planilha
carregada) e depois só relê o que mudou (`onSnapshot`). Com 50.000 leituras/dia, dá para
**abrir o painel ~500 vezes por dia** sem chegar perto do limite. Para uso pessoal/família,
a margem é de **mais de 99%**.

**Conclusão:** com a base atual (82 lançamentos), o sistema pode crescer **milhares de vezes**
antes de qualquer cobrança.

### 3.3 O que PODE gerar custo (para evitar surpresas)

| Situação | Custo | Como evitar |
|---|---|---|
| Plano Blaze ativado **e** estourar as cotas acima | cobrança por uso (Firestore: ~US$ 0,06/100 mil leituras) | **não ative o Blaze**; monitore em *Console → Usage* |
| Cadastro de **cartão de crédito** + plano Blaze | fatura automática do excedente | se ativar Blaze por Functions/Extensions, configure **orçamento (budget alert)** em *Google Cloud → Billing* |
| **Telefone/SMS** no login (Phone Auth) | por verificação (~US$ 0,01–0,06) | este sistema não usa; se usar, há custo |
| **Cloud Functions / Extensions** | exigem plano Blaze (pay-as-you-go; há cota grátis de invocações) | melhorias que precisem de servidor (ver §9) devem ser avaliadas |
| **Domínio próprio** (ex.: `seudominio.com.br`) | ~R$ 40–80/ano (registro, não é do Firebase) | opcional; os subdomínios `web.app`/`firebaseapp.com` são grátis e já têm HTTPS |
| Cloud Storage (fotos de notas) | grátis até 5 GB no Spark | — |

### 3.4 Onde acompanhar o consumo

1. <https://console.firebase.google.com> → seu projeto → menu **Usage and billing** (ou **Implantação e uso**)
2. **Firestore → Usage** (leituras/escritas/dia)
3. **Authentication → Usage** (usuários ativos/mês)
4. **Hosting → Usage** (transferência)

> **Recomendação de manutenção:** olhe o painel de uso **1 vez por mês** (leva 1 minuto).
> Se algum gráfico chegar a 70–80% da cota, revise §9 antes de qualquer contratação.

---

## 4. Onde os dados ficam armazenados

### 4.1 Mapa completo dos dados

| Dado | Onde fica | Sobrevive a trocar de dispositivo? | Excluído ao apagar a conta? |
|---|---|---|---|
| E-mail e senha do usuário | **Firebase Authentication** (servidor Google) | ✅ sim | ✅ sim (excluir em Authentication) |
| Nome/perfil | Firestore → `usuarios/{uid}` | ✅ sim | ✅ sim |
| Lançamentos | Firestore → `usuarios/{uid}/lancamentos/*` | ✅ sim | ✅ sim |
| Categorias | Firestore → `usuarios/{uid}/categorias/*` | ✅ sim | ✅ sim |
| Sessão logada / tema escolhido | `localStorage` do navegador | ❌ fica no aparelho | apagar dados do navegador |
| Dados no **modo local** (sem Firebase) | `localStorage` (chaves `fincontrol.*`) | ❌ só naquele navegador/navegador | apagar dados do navegador |
| Arquivos do site (HTML/CSS/JS) | Firebase Hosting (públicos por natureza) | — | — |
| Planilha `Controle_Financeiro_Profissional.xlsx` | **só no seu computador** — lida pelo navegador, **nunca enviada** | — | — |
| CSV/JSON exportados | baixados para a sua pasta de downloads | — | — |
| Código-fonte / repositório | **não há repositório Git público** (pasta local no OneDrive) | — | — |

### 4.2 Modelo de dados (Firestore)

```
usuarios
└── {uid}                          ← um documento por usuário
      ├── nome: "Renan"
      ├── email: "seu@email.com"
      ├── criadoEm: "2026-10-21T..."
      │
      ├── lancamentos              ← subcoleção
      │     └── {idAuto}
      │           ├── data:        "2026-10-21"   (ISO, obrigatório)
      │           ├── tipo:        "Despesa" | "Receita" | "Transferência"
      │           ├── categoria:   "Alimentação"
      │           ├── descricao:   "Feira do sábado"
      │           ├── valor:       123.45          (número, > 0)
      │           ├── situacao:    "Pago" | "Pendente" | "Cancelado"
      │           │                  (Receita usa "Recebido"/"Pendente")
      │           ├── observacoes: "texto livre"
      │           ├── criadoEm:    ISO
      │           ├── atualizadoEm:ISO
      │           └── uid:         "{uid}"         (só no modo firebase, ao criar)
      │
      └── categorias               ← subcoleção
            └── {idAuto}
                  ├── nome:  "Moradia"
                  ├── tipo:  "Despesa"
                  ├── cor:   "#e11d48"
                  └── criadoEm: ISO
```

* A competência (mês/ano) é **derivada de `data`** no cliente (`ymDe()`); a planilha
  original trazia colunas Mês/Ano que são ignoradas — vêm sempre da data.
* Regras de negócio no cliente: `valor > 0`, `data` e `descricao` obrigatórios;
  lançamentos **Cancelado** continuam no banco mas saem dos totais (`ativo()`).
* Importação em lote usa **batches de 450 documentos** (limite do Firestore).

### 4.3 Onde os dados NÃO ficam

* Não ficam na hospedagem (Hosting guarda só os arquivos do site — sem dados de usuário).
* Não ficam em repositório GitHub (não existe repositório público; `.gitignore` já protege
  `dados_extraidos/`, `.env`, chaves).
* Não são enviados para nenhum serviço de terceiros (sem Google Analytics, sem pixels).
* A planilha original **não é publicada em lugar nenhum** — a importação acontece 100% no navegador.

### 4.4 Criptografia e privacidade

* Tráfego: **HTTPS/TLS** obrigatório (certificado automático do Firebase).
* Repouso: dados criptografados pelo próprio Google Cloud.
* Isolamento: garantido pelas **regras do Firestore** (§8) — cada usuário só enxerga a própria
  subárvore `usuarios/{uid}`.
* As **chaves API** do Firebase que aparecem no código são **públicas por design** e não dão
  acesso a dados: quem acessa é só quem tem login, e mesmo assim apenas os próprios documentos.

### 4.5 Exclusão de dados (LGPD / direito ao esquecimento)

1. **Pelo app:** *Importar / Exportar → Exportar JSON* (backup antes) e, se for apagar tudo,
   `Store.apagarTudo()` é acionado pela interface de limpeza (apaga os docs da subcoleção).
2. **Pelo console:** *Authentication → Users → Delete* (remove login) e
   *Firestore → coleção `usuarios` → doc do uid → Delete* (remove todos os dados).
3. **No navegador:** *Configurações do site → Limpar dados* (modo local e sessão).

---

## 5. Mapa do projeto (arquivo por arquivo)

```
DESPESAS_MENSAIS/                          ← pasta raiz (OneDrive)
│
├── site/                                  ← ✅ TUDO QUE VAI PARA A HOSPEDAGEM
│   ├── index.html                         estrutura completa: telas de login, painel,
│   │                                      lançamentos, categorias, importação, config,
│   │                                      modais e sidebar
│   ├── robots.txt                         permite indexação (site é público)
│   ├── assets/favicon.svg                 ícone/marca
│   ├── css/styles.css                     design system, temas claro/escuro,
│   │                                      responsivo, variáveis CSS
│   └── js/
│       ├── config.js                      ⚙️ chaves do Firebase + nome da marca +
│       │                                  limite de importação (3000) e itens/página (15)
│       ├── store.js                       camada de dados/auth (API: ver §5.2)
│       ├── app.js                         toda a UI: render, filtros, CRUD, import/export,
│       │                                  roteamento por hash (#/painel, #/lancamentos…)
│       ├── charts.js                      Chart.js + fallback canvas puro
│       ├── exemplo.js                     235 lançamentos sintéticos p/ demonstração
│       └── (todos carregados por index.html; sem bundler)
│
├── firebase.json                          config do deploy: public="site", cleanUrls,
│                                          headers de cache, regras e índices do Firestore
├── .firebaserc                            projeto padrão: rm-controle-financeiro-a8d83
├── firestore.rules                        🔒 regras de isolamento por usuário (§8)
├── firestore.indexes.json                 índices compostos (hoje: vazio e válido)
├── netlify.toml                           deploy alternativo (Netlify)
├── vercel.json                            deploy alternativo (Vercel, outputDirectory=site)
├── .gitignore                             protege dados_extraidos/, chaves, node_modules
│
├── LEIA-ME.md                             guia de uso e configuração geral
├── DEPLOY-PASSO-A-PASSO.md                criar conta/projeto Firebase do zero + 5 hospedagens
├── DOCUMENTACAO-MANUTENCAO.md             ← este documento
│
├── Controle_Financeiro_Profissional.xlsx  📄 fonte dos dados (NUNCA colocar em site/)
├── extract_data.py                        utilitário offline (Python) para extrair a planilha
├── dados_extraidos/                       saída do script (gitignored) — NUNCA publicar
└── DESPESAS_MENSAIS.rar                   arquivo compactado do usuário (não faz parte do site)
```

### 5.1 `index.html` — principais blocos

| Bloco/ID | Papel |
|---|---|
| `#authPanel` (`<main>` no estado de login) | abas Entrar / Criar conta / Recuperar senha |
| `#appShell` | sidebar + `header` + `<main id="view">` |
| views `data-view`: `painel`, `lancamentos`, `categorias`, `importar`, `config` | roteadas por hash |
| `#modalLanc` + `#formLanc` | criar/editar lançamento (`valor`, `data`, `categoria`, `situacao`, `descricao`, `observacoes`) |
| `#modalConfirm` | confirmações (excluir, apagar tudo) |
| `#toast` | avisos flutuantes |
| `#btnCarregarExemplo` | carrega dados de demonstração (pode ser removido em produção) |

### 5.2 `store.js` — API pública (`window.Store`)

| Função | O que faz |
|---|---|
| `init()` / `status()` | escolhe firebase/local, carrega SDK, retorna `{mode, firebase}` |
| `onAuth(cb)` | devolve o usuário logado (ou null) |
| `signUp(dados)` | cria conta + grava perfil + semeia 8 categorias |
| `signIn(email, senha)` / `signOut()` | entrada/saída |
| `sendPasswordReset(email)` | envia e-mail de redefinição (só no modo firebase) |
| `updateProfile(nome)` | altera nome (Auth + Firestore) |
| `watchLanc(cb)` / `watchCats(cb)` | assina mudanças em tempo real (retorna função para cancelar) |
| `addLancamento` / `updateLancamento` / `deleteLancamento` | CRUD (modo firebase usa IDs do Firestore) |
| `importarLancamentos(items, ignorarDuplicados)` | importação em batches de 450 |
| `apagarTudo()` | apaga todos os lançamentos do usuário |
| `addCategoria` / `deleteCategoria` | CRUD de categorias |
| `categoriasPadrao()` | lista padrão (Moradia, Alimentação, Transporte, Saúde, Educação, Lazer, Cartão de crédito, Outros) |
| `getUser()` / `getMode()` | estado atual |

### 5.3 `app.js` — funções principais (73 funções)

| Grupo | Funções |
|---|---|
| Painel/KPIs | `renderPainel`, `kpi`, `totaisDo`, `variação`, `pendTotal`, `renderResumoAnual` |
| Tabela/filtros | `filtrados`, `renderTabela`, `montarSelectComp`, `montarSelectAno` |
| CRUD | `novoLancamento`, `editarLancamento`, `salvarLancamento`, `setTipoForm` |
| Importação | `processarArquivo`, `melhorAba`, `normalizarItem`, `lerArquivo`, `parseCSV`, `exibirPreview`, `confirmarImportacao` |
| Exportação | `exportCSV`, `exportJSON`, `exportResumo`, `baixarArquivo` |
| Gráficos | `redesenharGraficos`, `despesasPorCategoria` |
| Roteamento/estado | `rotear`, `renderTudo`, `renderInterna`, `irParaAba`, `boot`, `bind` |
| Tema | `aplicarTema`, `temaAtual` |
| Valores/idioma | `brl`, `parseValor`, `fmtData`, `mesLabel` |

### 5.4 Pontos de configuração rápidos

| Quero mudar | Arquivo → local |
|---|---|
| Nome da marca no site | `index.html` (`<title>`, `.brand__name` ×2, `<h2>` de boas-vindas) **e** `config.js` → `nome` |
| “Bem-vindo ao FinControl.” do toast de cadastro | `app.js` linha ~954 |
| Cores | `css/styles.css` → `:root` (`--brand`, `--brand-grad`) e `[data-theme="dark"]` |
| Ícone | `assets/favicon.svg` |
| Itens por página | `config.js` → `porPagina` |
| Limite de importação | `config.js` → `limiteImportacao` |
| Categorias padrão (novos usuários) | `store.js` → `categoriasPadrao()` |
| Valores/idioma | `app.js` → `brl()` |

> ⚠️ **Marca hoje inconsistente:** o título/sidebar já dizem “RM_Controle_Financeiro /
> Controle_Financeiro”, mas `config.js → nome` e o toast de cadastro ainda dizem “FinControl”.
> Padronizar: ver §9 (P0-1).

---

## 6. Deploy — publicar, atualizar, voltar atrás

### 6.1 Pré-requisitos nesta máquina

* Node.js 24 + npm 11 (instalados ✅) · git 2.49 (✅)
* CLI do Firebase: usa-se `npx firebase-tools` (v15.34.0) — **não exige instalação global**
* Login já feito nesta máquina (`npx firebase-tools login` → conta `themarine100328@gmail.com`)
* Abrir o terminal na pasta do projeto:
  ```powershell
  cd "C:\Users\renan.batista\OneDrive\PROJETOS COMPARTILHADOS\DESPESAS_MENSAIS"
  ```

### 6.2 Testar antes de publicar (sempre)

```powershell
cd site
python -m http.server 8080
# abre http://localhost:8080  → testa login, lançamentos, importação
# (o localhost é domínio autorizado por padrão no Firebase Auth)
```

### 6.3 Publicar alterações

```powershell
# deploy completo (site + regras do Firestore)
npx firebase-tools deploy

# só o site (mais rápido e o mais comum)
npx firebase-tools deploy --only hosting

# só as regras de segurança (após editar firestore.rules)
npx firebase-tools deploy --only firestore:rules
```

Saída esperada:
```
✔  Deploy complete!
Hosting URL: https://rm-controle-financeiro-a8d83.web.app
```

### 6.4 Voltar para a versão anterior (rollback)

```powershell
npx firebase-tools hosting:rollback      # escolhe a versão anterior no menu
```
Ou no console: **Hosting → Release history → Rollback**. O site tem histórico de versões;
o rollback é instantâneo e não afeta dados (dados estão no Firestore).

### 6.5 Deploy por outros provedores (alternativas gratuitas)

`netlify.toml` e `vercel.json` já estão prontos — detalhes em
[`DEPLOY-PASSO-A-PASSO.md`](DEPLOY-PASSO-A-PASSO.md) PARTE 5. Resumo:

```powershell
# Netlify (arrastar a pasta site em https://app.netlify.com/drop, ou:)
npx netlify-cli deploy --dir=site --prod

# Vercel
npx vercel && npx vercel --prod
```

> Se publicar fora do Firebase Hosting, **adicione o novo domínio** em
> *Firebase Console → Authentication → Settings → Authorized domains*, senão o login é bloqueado.

### 6.6 O que NUNCA colocar na pasta `site/`

* `Controle_Financeiro_Profissional.xlsx` (dados pessoais)
* pastas `dados_extraidos/`, scripts `.py`, `.rar`
* qualquer `.env`, chave de serviço (`service-account*.json`), backup `.json` de dados

---

## 7. Manutenção de rotina

### 7.1 Rotina semanal/mensal (checklist)

- [ ] **Backup mensal:** *Importar / Exportar → Exportar JSON* → guardar na pasta
      `backups/` (fora do `site/`) com o nome `backup-AAAA-MM.json`
- [ ] **1 minuto no console:** *Usage and billing* — conferir Firestore/Hosting/Auth (§3.4)
- [ ] Após qualquer alteração no código: teste local (§6.2) → deploy (§6.3) → confere a URL
- [ ] Semestralmente: conferir se as CDNs/versões das libs ainda existem (§1.3) e se o
      Firebase SDK não foi descontinuado

### 7.2 Backup e restauração

| Ação | Como |
|---|---|
| Exportar backup | app → **Importar / Exportar → Exportar JSON** (baixa arquivo com todos os lançamentos) |
| Exportar planilha legível | **Exportar CSV** (abre no Excel) |
| Restaurar backup | **Importar / Exportar → importar o `.json`** (marcar “ignorar duplicados”) |
| Backup automático | *não existe* — ver §9 (exige Cloud Functions/Blaze ou agendador local) |

> **Regra de ouro:** backup manual mensal enquanto o volume for pequeno. São 2 cliques.

### 7.3 Gerenciar usuários (console Firebase)

| Tarefa | Caminho no console |
|---|---|
| Ver usuários cadastrados | Authentication → **Users** |
| Criar usuário manualmente | Authentication → Users → **Add user** |
| Redefinir senha de alguém | Authentication → Users → usuário → *Reset password* (envia e-mail) |
| Excluir usuário | Authentication → Users → usuário → **Delete** |
| Ver e-mails enviados (recuperação) | Authentication → Templates (aprovar domínio se aparecer aviso) |

> Ao excluir o usuário, apague também o documento `usuarios/{uid}` no Firestore se quiser
> remover definitivamente os dados (§4.5).

### 7.4 Gerenciar dados de um usuário

* **Pelo app:** edição/exclusão em lote na aba *Lançamentos*; limpeza total com
  “apagar tudo” (confirmação obrigatória).
* **Pelo console:** *Firestore → `usuarios` → `{uid}` → `lancamentos`* — apagar docs
  individuais ou a subcoleção inteira.
* **Nunca edite dados de produção “de qualquer jeito”**: faça backup (JSON) antes.

### 7.5 Categorias

* **Alterar no app:** aba *Categorias* (adicionar/excluir) — afeta só o usuário logado.
* **Categorias padrão de novos usuários:** editar `store.js → categoriasPadrao()`
  (só muda quem cadastrar a partir daí — usuários existentes não são alterados).
* Se quiser “semeá-las” de novo num usuário, crie-as pela interface (não há re-seed automático).

### 7.6 Dependências externas

| Lib | Como atualizar |
|---|---|
| Firebase SDK | trocar a versão em `store.js` (`base = ".../firebasejs/10.12.5/"`) — testar login **antes** do deploy |
| Chart.js | `app.js` linha ~1150 (`chart.js@4.4.3`) |
| SheetJS | `app.js` linha ~658 (`xlsx-0.20.3`) |
| Google Fonts | `index.html` `<link>` |

Sempre: atualizar → teste local → importar uma planilha real → conferir gráficos → deploy.

### 7.7 Logs e diagnóstico

* **Navegador:** `F12` → aba *Console* (erros do app) e *Network* (falhas de rede/CDN).
* **Console Firebase:** *Firestore → Monitoring*, *Auth → Usage*, *Hosting → Release history*.
* O app também loga `Firebase indisponível, usando modo local.` quando cai para o modo local.

---

## 8. Segurança

### 8.1 Regras em vigor (`firestore.rules`)

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

**Significado:** só o dono logado lê/escreve na própria árvore `usuarios/{uid}`; **todo o
resto do banco é negado**. Usuário A nunca enxerga dados do usuário B.

*Após editar:* `npx firebase-tools deploy --only firestore:rules`
*Validar:* console → Firestore → **Rules → Rules playground** (simule outro `uid` e confira
que dá `deny`).

### 8.2 Chaves no código

As chaves do `firebaseConfig` ficam em `site/js/config.js` e são **públicas por design**:
elas identificam o projeto, **não autorizam acesso**. A proteção vem das regras + Auth.
Não há problema em o código ser público (inclusive em GitHub).

**Se uma chave “vazar”**: mesmo assim os dados continuam protegidos; para trocar,
gere novo app web no console e atualize `config.js` (§5.4).

### 8.3 Domínios autorizados

Hoje: `localhost`, `rm-controle-financeiro-a8d83.web.app`,
`rm-controle-financeiro-a8d83.firebaseapp.com`, `firebaseapp.com`.
Console → **Authentication → Settings → Authorized domains** ao adicionar domínio próprio
(Netlify/Vercel/Cloudflare) — sem isso o login retorna `auth/unauthorized-domain`.

### 8.4 Lacunas conhecidas (melhorias sugeridas em §9)

* E-mail **não é verificado** no cadastro (sem `sendEmailVerification`)
* **Sem 2FA** e sem provedores sociais (Google sign-in)
* Senha mínima de **6 caracteres** (política do Firebase)
* Sem limite de tentativas próprias (o Firebase já tem proteção anti-abuso)
* Modo local guarda senha como **hash simples** (é um fallback de demonstração — usar
  apenas sem Firebase configurado)

---

## 9. Roadmap — melhorias futuras

> **P0** = manutenção/consistência (fazer primeiro) · **P1** = valor para o usuário ·
> **P2** = escala/recursos avançados · **💰** = indica se gera custo

### P0 — consistência e operação

| # | Melhoria | Onde mexer | Esforço | 💰 |
|---|---|---|---|---|
| P0-1 | **Padronizar a marca** (hoje: “RM_Controle_Financeiro” no título, “Controle_Financeiro” na sidebar, “FinControl” em `config.js → nome` e no toast de cadastro) | `index.html` (4 pontos), `config.js` (`nome`), `app.js` (~linha 954), comentários dos `.js` | baixo | grátis |
| P0-2 | Definir política de **backup mensal** (pasta `backups/` fora do `site/`) | processo manual (§7.2) | baixo | grátis |
| P0-3 | Decidir destino da **conta de teste** (manter como demo ou excluir) | console Authentication | baixo | grátis |
| P0-4 | Remover/ocultar botão “Dados de exemplo” em produção | `index.html` (`#btnCarregarExemplo`) + `exemplo.js` | baixo | grátis |
| P0-5 | Colocar o código no **GitHub privado** (versionamento/histórico; `.gitignore` já pronto) | `git init` + remote privado | baixo | grátis |
| P0-6 | Rotina de **monitoramento de uso** mensal (§3.4) | console | baixo | grátis |

### P1 — valor para o usuário

| # | Melhoria | Onde mexer | Esforço | 💰 |
|---|---|---|---|---|
| P1-1 | **Verificação de e-mail** no cadastro + aviso “confirme seu e-mail” | `store.js → signUp` + `index.html` | baixo | grátis |
| P1-2 | **Alterar senha / apagar conta** na tela Configurações | `app.js`, `index.html` | médio | grátis |
| P1-3 | Login com **conta Google** | `store.js` + console Auth (ativo Google) | médio | grátis |
| P1-4 | **Orçamento por categoria** (limite mensal com alerta visual) | doc `usuarios/{uid}/orcamentos` + `renderPainel` | médio | grátis |
| P1-5 | **Lançamentos recorrentes** (gerar do mês seguinte automaticamente no login) | `app.js` ao entrar + novo campo `recorrente` | médio | grátis |
| P1-6 | **Múltiplas contas/cartões** (filtro por conta) | novo campo + filtros + importação | médio | grátis |
| P1-7 | **Exportar PDF** do painel | lib CDN (jsPDF/html2canvas) em `exportResumo` | médio | grátis |
| P1-8 | **PWA / app instalável** (ícone no celular, abre rápido) | `manifest.json` + service worker + `index.html` | médio | grátis |
| P1-9 | **Importar OFX/CNAB** (bancos) além de xlsx/csv/json | `app.js → processarArquivo/normalizarItem` | médio | grátis |
| P1-10 | Busca/filtro por **período personalizado** e ordenação da tabela | `app.js → filtrados/renderTabela` | baixo | grátis |
| P1-11 | **Compartilhar com conjuge** (2 usuários vendo os mesmos dados) | regras: allow read se `request.auth.uid in recurso.participantes` + UI de convite | alto | grátis |
| P1-12 | Fotos/notas fiscais por lançamento | Cloud Storage (5 GB grátis no Spark) + campo `fotoUrl` | alto | grátis |
| P1-13 | Acessibilidade/tema: modo alto contraste, preferência de sistema | `styles.css`, `app.js → aplicarTema` | baixo | grátis |
| P1-14 | Multi-idioma (en) / moeda configurável | `app.js → brl` + dicionário | médio | grátis |

### P2 — escala e automação (atenção ao custo 💰)

| # | Melhoria | Observação | 💰 |
|---|---|---|---|
| P2-1 | **Backup automático** no Firebase Storage | exige **Cloud Functions (Blaze)** ou extensão → há cota grátis, mas **Blaze exige cartão** e orçamento configurado | 💰 avaliar |
| P2-2 | **Resumo mensal por e-mail** | igual a P2-1 (Functions + provedor de e-mail) ou serviço externo | 💰 avaliar |
| P2-3 | Alertas/notificações push | Firebase Cloud Messaging é grátis; o gatilho (function) exige Blaze | 💰 avaliar |
| P2-4 | Índices compostos para filtros avançados (ex.: `data` + `categoria` + `situacao`) | Firestore mostra o link para criar — **grátis** | grátis |
| P2-5 | **Domínio próprio** (ex.: `rmcontrole.com.br`) | só o registro do domínio é pago (~R$ 40–80/ano) | 💰 domínio |
| P2-6 | Multi-empresa/multi-idioma SaaS, times grandes | provavelmente exige Blaze + revisão de regras | 💰 avaliar |

### 9.1 Roteiro sugerido

1. **Semana 1:** P0-1, P0-4 (padronizar marca e limpar demo) → deploy.
2. **Semana 2:** P0-2/P0-5 (backup + Git privado), P0-6 (rotina de uso).
3. **Depois:** P1-1 → P1-2 → P1-3 (confiança do usuário) → P1-5/P1-4 (uso do dia a dia) →
   P1-8 (celular).
4. P2 só quando houver necessidade real — avaliar custo antes de ativar Blaze.

---

## 10. Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| Cadastro dá `auth/operation-not-allowed` | E-mail/senha desativado | console → Authentication → Sign-in method → **E-mail/senha → Enable** |
| Login dá `auth/invalid-credential` | e-mail/senha errados | conferir usuário em Authentication → Users; usar “Recuperar senha” |
| Login dá `auth/unauthorized-domain` | domínio novo não autorizado | Authentication → Settings → **Authorized domains** → adicionar |
| Erro `permission-denied` no Firestore | regras não publicadas ou usuário errado | `npx firebase-tools deploy --only firestore:rules`; conferir quem está logado |
| Tela em branco / JS quebrado | erro de sintaxe ou chave mal colada | `F12` → Console; revise `config.js` (aspas/sem espaços) |
| Selo diz “Modo local” | `apiKey`/`projectId` vazios ou `modo:"local"` | `site/js/config.js` |
| Log “Firebase indisponível, usando modo local.” | sem internet ou CDN bloqueada | o site segue funcionando local; restaure a rede |
| Dados “sumiram” ao trocar de navegador | estavam no modo local (localStorage) | configurar Firebase (já feito) e refazer login |
| Dados de um usuário some após logar | logado em outra conta | conferir e-mail no canto da sidebar |
| Importação não acha as colunas | abas erradas/planilha diferente | `melhorAba()` detecta pela linha com Data/Tipo/Valor; renomeie colunas da planilha ou ajuste `normalizarItem` |
| Importação trava em arquivo grande | limite de 3000 itens | aumentar `limiteImportacao` em `config.js` (atenção às cotas) |
| Gráficos não aparecem | Chart.js não carregou (CDN) | há fallback canvas; teste rede/CDN |
| Deploy antigo aparecendo | cache | `npx firebase-tools deploy --only hosting`; no navegador `Ctrl+F5`; Netlify: *Clear cache and deploy* |
| Erro de índice no Firestore | consulta com 2+ ordenações sem índice | clicar no link do erro → Firebase cria o índice (grátis) |
| `firebase login` falha com “Invalid project id” | `.firebaserc` com placeholder | colocar o ID real `rm-controle-financeiro-a8d83` |
| OneDrive conflitando com arquivos do deploy | sincronização travando arquivo | abrir a pasta no Explorador, aguardar sincronizar, repetir o deploy |

---

## 11. Referência rápida de comandos

```powershell
# ---- ir para a pasta do projeto ----
cd "C:\Users\renan.batista\OneDrive\PROJETOS COMPARTILHADOS\DESPESAS_MENSAIS"

# ---- testar local ----
cd site; python -m http.server 8080        # http://localhost:8080

# ---- autenticação / projeto ----
npx firebase-tools login                    # autenticar no navegador
npx firebase-tools login:list               # contas autorizadas
npx firebase-tools projects:list            # listar projetos
npx firebase-tools use rm-controle-financeiro-a8d83

# ---- deploy ----
npx firebase-tools deploy                   # tudo (site + regras + índices)
npx firebase-tools deploy --only hosting    # só o site
npx firebase-tools deploy --only firestore:rules
npx firebase-tools hosting:rollback         # voltar versão
npx firebase-tools hosting:sites:list       # sites de hospedagem
npx firebase-tools open                     # abre o site no navegador

# ---- informações ----
npx firebase-tools apps:list
npx firebase-tools apps:sdkconfig WEB       # chaves do app web (config.js)
npx firebase-tools --version                # 15.34.0 (verificado em 21/10/2026)
```

**Links úteis**

| Finalidade | URL |
|---|---|
| Site em produção | <https://rm-controle-financeiro-a8d83.web.app> |
| Console Firebase | <https://console.firebase.google.com/project/rm-controle-financeiro-a8d83/overview> |
| Usuários (Auth) | <https://console.firebase.google.com/project/rm-controle-financeiro-a8d83/authentication/users> |
| Banco (Firestore) | <https://console.firebase.google.com/project/rm-controle-financeiro-a8d83/firestore/data> |
| Regras | <https://console.firebase.google.com/project/rm-controle-financeiro-a8d83/firestore/rules> |
| Uso/custos | <https://console.firebase.google.com/project/rm-controle-financeiro-a8d83/usage> |
| Hosting/releases | <https://console.firebase.google.com/project/rm-controle-financeiro-a8d83/hosting> |
| Planos e cotas | <https://firebase.google.com/pricing> |

---

## 12. Registro de versões (changelog)

| Versão | Data | Mudança |
|---|---|---|
| **1.0** | 21/10/2026 | Primeiro deploy em produção: SPA completa (login, painel, lançamentos, categorias, importação xlsx/csv/json, exportações, configurações), Firebase Auth + Firestore conectados, regras de isolamento publicadas, testes ponta a ponta aprovados (cadastro → gravação → persistência após reload). Documentação criada. |
| **1.1** | 21/10/2026 | **Painel:** card “Melhores juros de investimento do dia” (Selic/CDI/poupança via API do Banco Central — SGS 432/12/195, com cache diário, repetições de requisição e modo offline) posicionado após Pendências; taxa de poupança movida para os chips; novos cards “Ritmo do mês” (média/dia, projeção, comparativo) e “Maiores despesas”. **Competência:** o seletor do topo lista apenas meses com lançamentos + “Todo o período”. **PIX:** tipo substituiu “Transferência” (importação, filtros, badge e migração automática de dados antigos); “Recebido” conta como receita, “Pago” como despesa e “Pendente” só aparece em pendências, com dica no formulário. **Correção:** editar um lançamento restaurava a situação errada (select era recriado). **Lançamentos:** novos filtros de período (De/Até) e ordenação (data/valor/descrição). **Categorias:** busca por texto e filtro por tipo. **PWA:** manifest.webmanifest, ícones PNG 192/512/maskable e service worker (app shell e taxas em cache offline; Auth/Firestore sempre em rede), registro automático em `app.js` e headers `no-cache` para `sw.js`/manifest. **API do BCB:** série 432 limitada a 20 valores, seleção por maior data (séries chegam em ordens mistas) e retries p/ falha intermitente de CORS. |

**Próxima versão (sugestão):** 1.2 — padronização da marca (P0-1), remoção da demo (P0-4),
verificação de e-mail (P1-1), geração de APK/Windows via PWABuilder a partir do PWA publicado.

---

*Documento vivo: atualize esta tabela (§12) a cada mudança relevante e registre decisões
de custo/segurança nas seções §3 e §8.*
