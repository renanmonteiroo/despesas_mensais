# DEPLOY — Publicação manual do site (passo a passo e comandos)

> Documento de manutenção operacional: como publicar o site do zero, com qual comando,
> como usar o domínio **rmcontrolefinanceiro.com.br**, como voltar uma versão e o que
> conferir depois. Complementa o `DOCUMENTACAO-MANUTENCAO.md` (visão geral técnica).

---

## 1. O que é publicado

| Item | Detalhe |
|---|---|
| O que vai ao ar | A pasta **`site/`** inteira (SPA estática: HTML, CSS, JS, ícones, manifest, service worker) |
| Onde sobe | Firebase Hosting — projeto **`rm-controle-financeiro-a8d83`** |
| Endereço principal | **https://rmcontrolefinanceiro.com.br** (domínio do Registro.br) |
| Endereços antigos | `https://rm-controle-financeiro-a8d83.web.app` e `…firebaseapp.com` (redirecionam para o domínio principal — ver §6) |
| Banco de dados | Cloud Firestore (não afeta o deploy de arquivos; regras próprias, ver §9) |
| Arquivo proibido | `Controle_Financeiro_Profissional.xlsx` **nunca** deve estar dentro de `site/` (dados pessoais) |

---

## 2. Pré-requisitos

1. **Node.js 18+** instalado (`node -v` para conferir).
2. Conta Google com acesso ao projeto Firebase.
3. Terminal aberto **na pasta do projeto** (a que contém `firebase.json` e `.firebaserc`):

```powershell
cd "C:\Users\renan.batista\OneDrive\PROJETOS COMPARTILHADOS\DESPESAS_MENSAIS"
```

> A CLI do Firebase não precisa de instalação global: usamos `npx firebase-tools`
> (baixa/cache automaticamente; versão usada: 15.34.0).

---

## 3. Primeira vez: autenticação (só uma vez por máquina)

```powershell
npx firebase-tools login        # abre o navegador para autorizar a conta Google
npx firebase-tools login:list   # deve listar themarine100328@gmail.com
npx firebase-tools projects:list
```

O projeto padrão já vem configurado no arquivo `.firebaserc`:

```json
{ "projects": { "default": "rm-controle-financeiro-a8d83" } }
```

Se algum dia faltar, é só recriar esse arquivo ou rodar `npx firebase-tools use rm-controle-financeiro-a8d83 --add`.

---

## 4. Comandos essenciais (glossário rápido)

| O que você quer fazer | Comando |
|---|---|
| **Publicar o site** (o comando do dia a dia) | `npx firebase-tools deploy --only hosting` |
| Publicar tudo (site + regras + índices) | `npx firebase-tools deploy` |
| Publicar só as regras do Firestore | `npx firebase-tools deploy --only firestore:rules` |
| Publicar regras + índices | `npx firebase-tools deploy --only firestore` |
| **Voltar para a versão anterior** | `npx firebase-tools hosting:rollback` |
| Testar antes de publicar (link temporário) | `npx firebase-tools hosting:channel:deploy teste -e 2h` |
| Ver canais de preview abertos | `npx firebase-tools hosting:channel:list` |
| Listar sites de hosting | `npx firebase-tools hosting:sites:list` |
| Abrir o site no navegador | `npx firebase-tools open` |
| Ver quem está logado | `npx firebase-tools login:list` |
| Trocar de projeto | `npx firebase-tools use <id-do-projeto>` |
| Ver versão da CLI | `npx firebase-tools --version` |

---

## 5. Fluxo manual de deploy — do zero ao ar

1. **Abra o terminal** na pasta do projeto (§2).
2. *(Primeira vez apenas)* autentique (§3).
3. **Confira o que vai mudar** — edite os arquivos de `site/` normalmente
   (ex.: `site/js/app.js`, `site/index.html`, `site/css/styles.css`).
4. **Publique:**

   ```powershell
   npx firebase-tools deploy --only hosting
   ```

5. **Espere a confirmação** — a saída deve terminar assim:

   ```
   +  hosting[rm-controle-financeiro-a8d83]: file upload complete
   +  hosting[rm-controle-financeiro-a8d83]: version finalized
   +  hosting[rm-controle-financeiro-a8d83]: release complete
   +  Deploy complete!
   Hosting URL: https://rm-controlefinanceiro.com.br
   ```

   (Nos primeiros deploys, a URL listada ainda é a `…web.app`; ambas funcionam.)

6. **Checklist pós-deploy** (2 minutos):

   - [ ] Abra o site em uma **janela anônima** (evita cache): o login aparece?
   - [ ] Entre com a conta de teste e confira o **Painel** sem erros (F12 → Console vazio)?
   - [ ] Crie e exclua um lançamento de teste?
   - [ ] Mudou o visual/JS? **Ctrl+F5** para tirar o cache de até 1 h (ver §10).

---

## 6. Domínio rmcontrolefinanceiro.com.br (Registro.br → Firebase)

O domínio **não substitui** o Firebase: ele só **aponta** para o Firebase Hosting.
O fluxo completo tem 3 partes: **(A)** Firebase Console, **(B)** Registro.br, **(C)** Auth.

### A) Firebase Console — adicionar o domínio (fazer 1.º)

1. Abra <https://console.firebase.google.com> → projeto **rm-controle-financeiro-a8d83** → **Hosting**.
2. Aba **Domains** → **Add custom domain** → digite `rmcontrolefinanceiro.com.br` → Continue.
3. Marque a opção de **servir o conteúdo** do site (e, se aparecer, a opção de
   redirecionar `www` → domínio raiz).
4. O console mostra os registros DNS a criar (§B) e fica em **"Waiting for DNS / Pending"**.
   > ⚠️ Importante: o domínio deve estar cadastrado aqui como **servindo o conteúdo**,
   > e **não** como redirecionando para a `…web.app`. Se ele estiver como redirect,
   > o site continua trocando a URL — nesse caso, remova o domínio e adicione de novo
   > com a opção de servir conteúdo.

### B) Registro.br — configurar o DNS

No painel do Registro.br, no domínio → **Serviços DNS** → **"Configurar endereçamento"**:

| Tipo | Nome (host) | Valor |
|---|---|---|
| A | *(vazio — domínio raiz)* | `216.239.32.21` |
| A | *(vazio — domínio raiz)* | `216.239.34.21` |
| A | *(vazio — domínio raiz)* | `216.239.36.21` |
| A | *(vazio — domínio raiz)* | `216.239.38.21` |
| CNAME | `www` | `rm-controle-financeiro-a8d83.web.app` |

> **Se houver encaminhamento web ativo** (o painel do Registro.br tem um item de
> encaminhamento/redirecionamento de URL), **remova-o** — ele responde `302 → …web.app`
> e é justamente o que faz a URL trocar. O DNS do Firebase substitui esse serviço.
> Confirme depois em: `nslookup rmcontrolefinanceiro.com.br` (deve dar os IPs 216.239.x.x).

Após salvar, o Firebase detecta sozinho e emite o **certificado HTTPS automático e
gratuito** (Let's Encrypt) — minutos nas próximas vezes, até 24 h na primeira.

### C) Firebase Authentication — domínio autorizado

Se o **login** der erro de domínio não autorizado:

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**.
2. **Add domain** → `rmcontrolefinanceiro.com.br`.

(Em geral domínio conectado ao Hosting já entra automaticamente, mas vale conferir.)

### Redirecionamento dos endereços antigos (já implementado)

O `site/index.html` contém um script no `<head>` que redireciona
`*.web.app` e `*.firebaseapp.com` → `https://rmcontrolefinanceiro.com.br`
(preservando caminho, `?query` e `#hash`), com proteção contra laço de
redirecionamento (contador válido por 15 s). Enquanto o DNS do domínio principal
não apontar para o Firebase, o site para no endereço antigo em vez de travar em loop.

> Para reverter no futuro (voltar ao `.web.app`): apague o bloco
> `<script>…fc.redir…</script>` e a tag `<link rel="canonical">` no `index.html`
> e faça um novo deploy.

---

## 7. Voltar para a versão anterior (rollback)

```powershell
npx firebase-tools hosting:rollback
```

A CLI abre um menu com as versões publicadas; escolha a anterior e confirme.
A troca é imediata (não precisa novo deploy). Para listar as versões, veja o
Firebase Console → Hosting → Release history.

---

## 8. Testar antes de publicar (canal de preview)

```powershell
npx firebase-tools hosting:channel:deploy teste -e 2h
```

Cria um link temporário tipo `…web.app/teste…` (válido 2 h) com a sua alteração,
sem mexer em produção. Ótimo para conferir o site em outro dispositivo antes do deploy real.

---

## 9. Publicar regras do Firestore (separado do site)

Regras de segurança **não** sobem com o deploy do site:

```powershell
npx firebase-tools deploy --only firestore:rules     # regras
npx firebase-tools deploy --only firestore           # regras + índices
```

Arquivos envolvidos: `firestore.rules` e `firestore.indexes.json`.

---

## 10. Cuidados importantes

1. **Cache do navegador**: `js`/`css` são servidos com `max-age=3600` (1 h). Depois de
   um deploy, quem já visitou o site pode ficar com a versão antiga até 1 h —
   `Ctrl+F5` limpa. Visitantes novos recebem a versão nova na hora.
2. **Service worker (PWA)**: ao mudar o "casca" do app (`index.html`, `app.js`,
   `styles.css`), incremente a constante `V` no topo do `site/sw.js`
   (ex.: `fincontrol-v3` → `fincontrol-v4`). Sem isso, dispositivos instalados
   podem ficar com os arquivos antigos em cache offline.
3. **Nunca suba a planilha** `Controle_Financeiro_Profissional.xlsx` para a pasta `site/`
   nem a commite no repositório público — ela tem dados pessoais. A importação é feita
   pelo navegador do usuário.
4. **O deploy não afeta os dados** dos usuários (Firestore fica como está); dados só mudam
   pelas regras/migrações do app.

---

## 11. Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| Deploy antigo aparecendo | cache do navegador | `Ctrl+F5`; conferir se o deploy terminou `Deploy complete!` |
| Site ficou antigo só em aparelho instalado | cache do service worker | incrementar `V` no `sw.js` + novo deploy |
| `rmcontrolefinanceiro.com.br` muda para a `…web.app` | encaminhamento do Registro.br ou domínio como "redirect" no Firebase | §6-B remover encaminhamento; §6-A domínio servindo conteúdo |
| `rmcontrolefinanceiro.com.br` não abre / "não resolve" | DNS ainda propagando ou registro errado | conferir os 5 registros em §6-B; `nslookup rmcontrolefinanceiro.com.br` |
| Aviso "connection is not private" no domínio novo | certificado ainda emitindo | aguardar (até 24 h na 1.ª vez), recarregar depois |
| Erro de domínio não autorizado no login | domínio fora da lista do Auth | §6-C Authorized domains |
| `permission-denied` no Firestore | regras não publicadas | `npx firebase-tools deploy --only firestore:rules` |
| `Not logged in` / `no project active` | CLI sem login ou sem projeto | §3 (`login:list`, `use`) |

---

*Atualize este documento sempre que mudar domínio, comandos ou o fluxo de publicação.
Referências gerais: `DOCUMENTACAO-MANUTENCAO.md` (§11 = comandos rápidos, §12 = changelog).*
