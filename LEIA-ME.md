# 📊 FinControl — Controle Financeiro Pessoal

Site completo e profissional para registrar e consultar **lançamentos de despesas e receitas mensais**,
criado a partir da estrutura do arquivo `Controle_Financeiro_Profissional.xlsx`.

- **Login real** (e-mail/senha) + **recuperação de senha** por e-mail
- Cada usuário vê **apenas os próprios lançamentos** (contas isoladas)
- Painel com receitas, despesas, saldo, **taxa de poupança**, gráfico de fluxo mensal,
  donut de categorias, pendências e resumo anual por categoria
- CRUD completo com filtros (mês, tipo, categoria, situação, busca) e paginação
- **Importação da sua planilha `.xlsx`** (lida no navegador — o arquivo nunca é publicado)
- Exportação CSV / JSON e resumo anual
- Tema claro/escuro, 100% responsivo, gratuito

> 🕹️ **Teste agora:** dentro da pasta `site`,
> `python -m http.server 8080` e abra <http://localhost:8080>
> (sem servidor: `npx serve site`).

> 🌐 **Em produção:** <https://rm-controle-financeiro-a8d83.web.app>
> (projeto Firebase `rm-controle-financeiro-a8d83` · plano Spark · custo R$ 0)

### 📚 Documentação do projeto

| Documento | Para quê |
|---|---|
| [`LEIA-ME.md`](LEIA-ME.md) (este) | entender o sistema, configurar o Firebase e hospedar |
| [`DEPLOY-PASSO-A-PASSO.md`](DEPLOY-PASSO-A-PASSO.md) | criar a conta e o projeto Firebase do zero e publicar |
| [`DOCUMENTACAO-MANUTENCAO.md`](DOCUMENTACAO-MANUTENCAO.md) | **manutenção, custos, onde ficam os dados, segurança, melhorias futuras e troubleshooting** |

---

## 1. Como o sistema funciona

| Modo | Quando é usado | Onde ficam os dados |
|---|---|---|
| **Firebase (nuvem)** | Depois de colar as chaves em `site/js/config.js` | Cloud Firestore (sincroniza em todos os dispositivos) |
| **Local (padrão)** | Enquanto o `config.js` estiver vazio | `localStorage` do navegador — só para testar |

O modo é escolhido **automaticamente**: há chaves → Firebase; não há → local.

---

## 2. Configurar o Firebase (5 minutos, gratuito)

1. Acesse <https://console.firebase.google.com> → **Adicionar projeto** (plano **Spark**, grátis).
2. No projeto: **Build → Authentication → Get started → Sign-in method → E-mail/senha → Ativar**.
3. Em **Authentication → Users → Add user**, crie o primeiro usuário (ou use a tela de cadastro do site).
4. **Build → Firestore Database → Create database** → modo *production* → região mais próxima →
   **Rules** → cole o conteúdo de [`firestore.rules`](firestore.rules) → **Publish**.
5. **Configurações do projeto → Seus apps → Web (`</>`)** → registre o app →
   copie o objeto `firebaseConfig` e cole os valores em [`site/js/config.js`](site/js/config.js):

```js
firebase: {
  apiKey: "AIzaSy...",            // preencha com o seu
  authDomain: "meu-projeto.firebaseapp.com",
  projectId: "meu-projeto",
  storageBucket: "meu-projeto.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
}
```

6. Recarregue o site: o selo da tela de login passa a dizer
   *"Firebase Authentication · dados na nuvem"*.

**Limites do plano Spark (mais que suficiente):** 10 mil logins/mês, 50 mil leituras/dia,
20 mil escritas/dia, 1 GiB de armazenamento — sem cartão de crédito.

---

## 3. Hospedagem gratuita — opções

| Opção | Custo | Publicar | Domínio | Observação |
|---|---|---|---|---|
| **Firebase Hosting** ⭐ | Grátis (Spark) | `firebase deploy` | `seu-projeto.web.app` | Mesma conta do Auth/Firestore — recomendado |
| **Netlify** | Grátis | Arrastar a pasta `site` em app.netlify.com/drop | `*.netlify.app` | Mais rápido (30 s, sem terminal) |
| **Vercel** | Grátis | `npx vercel` na pasta do projeto | `*.vercel.app` | Já configurado (`vercel.json`) |
| **Cloudflare Pages** | Grátis | Upload da pasta `site` ou repositório GitHub | `*.pages.dev` | Melhor desempenho global |
| **GitHub Pages** | Grátis | Publicar a pasta `site` na branch `gh-pages` | `*.github.io` | Ideal se o projeto estiver no GitHub |

> ⚠️ **Importante:** qualquer hospedagem publica o conteúdo da pasta `site/`.
> A planilha `Controle_Financeiro_Profissional.xlsx` fica **fora** da pasta `site/`
> e é importada pelo navegador — mantenha assim.

### A. Firebase Hosting (recomendado)

```bash
npm install -g firebase-tools     # uma vez
firebase login                    # use a mesma conta do console
# edite .firebaserc e troque "SEU_ID_DO_PROJETO_AQUI" pelo id do projeto
firebase deploy                   # sobe site/ + regras do Firestore
```

### B. Netlify (sem terminal)

1. Acesse <https://app.netlify.com/drop>
2. Arraste a pasta **`site`** para a área de upload
3. Pronto: você recebe um endereço `https://....netlify.app`

### C. Vercel

```bash
npx vercel            # confirme o diretório: site (já vem no vercel.json)
npx vercel --prod     # publica em produção
```

### D. Cloudflare Pages

Crie um repositório no GitHub, envie a pasta do projeto e no painel do Cloudflare:
**Workers & Pages → Create → Pages → Upload assets** → pasta `site` → Deploy.

### E. GitHub Pages

```bash
git init && git add . && git commit -m "FinControl"
git remote add origin https://github.com/SEU_USUARIO/fincontrol.git
git push -u origin main
```
No repositório: **Settings → Pages → Branch: `gh-pages`** (ou use a ação
`peaceiris/actions-gh-pages` apontando para a pasta `site`).

### Domínio próprio

Em qualquer uma das opções acima você pode apontar um domínio que já tenha
(Netlify/Vercel/Cloudflare Pages permitem domínio próprio **grátis**, com HTTPS automático).

---

## 4. Importando a sua planilha

1. Entre com o seu login → **Importar / Exportar**
2. Arraste o `Controle_Financeiro_Profissional.xlsx` (ou clique em *Selecionar arquivo*)
3. O sistema **localiza automaticamente a aba de lançamentos** (ignora Painel, Resumo, Listas…)
4. Confira a pré-visualização (linhas inválidas, como valores `0`, são descartadas)
5. Marque **“Ignorar lançamentos já existentes”** se for reimportar
6. **Importar lançamentos**

**Colunas reconhecidas:** Data · Tipo · Categoria · Descrição · Valor (R$) · Situação · Observações.
Também aceita `.csv` (separador `;` ou `,`) e `.json` no formato exportado pelo próprio site.

---

## 5. Estrutura do projeto

```
DESPESAS_MENSAIS/
├─ site/                      ← conteúdo publicado (100% estático)
│  ├─ index.html              ← app (login + telas)
│  ├─ css/styles.css          ← design system (tema claro/escuro)
│  ├─ assets/favicon.svg
│  └─ js/
│     ├─ config.js            ← ⚙️ cole aqui as chaves do Firebase
│     ├─ store.js             ← autenticação + Firestore/local
│     ├─ app.js               ← telas, filtros, importação/exportação
│     ├─ charts.js            ← gráficos (Chart.js + fallback nativo)
│     └─ exemplo.js           ← dados sintéticos de demonstração
├─ Controle_Financeiro_Profissional.xlsx   ← sua planilha (NÃO publicar)
├─ extract_data.py            ← opcional: converte a planilha em JSON local
├─ firebase.json / .firebaserc / firestore.rules   ← deploy Firebase
├─ netlify.toml / vercel.json                          ← deploy Netlify/Vercel
└─ LEIA-ME.md                 ← este arquivo
```

---

## 6. Segurança e boas práticas

- As regras do Firestore garantem que **só o dono da conta** lê/escreve os próprios dados.
- Nunca suba a planilha (nem a pasta `dados_extraidos/`) para dentro de `site/`.
- O modo **local** guarda tudo no navegador: use apenas para testes — a nuvem é o que
  permite “recuperar os lançamentos” de qualquer dispositivo.
- Faça **Exportar → JSON** de vez em quando: é o seu backup.
- As senhas nunca ficam no código: no modo local elas são salvas apenas como hash SHA-256.

---

## 7. Perguntas frequentes

**Preciso pagar alguma coisa?** Não. Firebase (Auth + Firestore + Hosting), Netlify,
Vercel, Cloudflare Pages e GitHub Pages têm planos gratuitos que cobrem esse uso com folga.

**Funciona no celular?** Sim — layout responsivo e menu hambúrguer abaixo de 1024 px.

**Posso ter vários usuários?** Sim; cada conta tem seus lançamentos e categorias isolados.

**Como apago os dados de teste?** Configurações → *Apagar todos os meus dados*.

**Os gráficos precisam de internet?** O site usa Chart.js por CDN; sem internet ele
desenha gráficos nativos em canvas — nada quebra.
