/* =========================================================
   FinControl · aplicação (app.js)
   ========================================================= */
(function () {
  "use strict";

  var CFG = window.APP_CONFIG;
  var MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  var MES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var ANOS = { corrente: new Date().getFullYear() };

  var S = {
    user: null, mode: "local",
    lanc: [], cats: [], contas: [], metas: [],
    comp: ymHoje(), busca: "", tipo: "", cat: "", sit: "", conta: "",
    de: "", ate: "", ordem: "data-desc",
    catBusca: "", catTipo: "",
    pag: 1, anoRef: ANOS.corrente,
    editId: null, formTipo: "Despesa",
    contaEditId: null, metaEditId: null, aporteMetaId: null,
    importPendente: null, stopLanc: null, stopCats: null
  };
  var SEMCONTA = "(sem-conta)";

  var unsubAuth = null, unsubLanc = null, unsubCats = null, unsubContas = null, unsubMetas = null, confirmCb = null;

  /* ================= utils ================= */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function brl(v) { return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function brlCurto(v) {
    v = Number(v) || 0;
    if (Math.abs(v) >= 10000) return "R$ " + (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil";
    return brl(v);
  }
  function ymHoje() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
  function ymDe(iso) { return (iso || "").slice(0, 7); }
  function fmtData(iso) {
    if (!iso) return "—";
    var p = String(iso).split("-");
    if (p.length < 3) return iso;
    return p[2] + "/" + p[1] + "/" + p[0];
  }
  function mesLabel(ym) { var p = ym.split("-"); return MES_CURTO[Number(p[1]) - 1] + " " + p[0]; }
  function mesExt(ym) { var p = ym.split("-"); return MES_LONGO[Number(p[1]) - 1] + "/" + p[0]; }
  function somaMesclar(a, b) { var r = {}, k; for (k in a) r[k] = a[k]; for (k in b) r[k] = b[k]; return r; }

  function parseValor(txt) {
    if (typeof txt === "number") return txt;
    var s = String(txt == null ? "" : txt).replace(/[^\d,.-]/g, "").trim();
    if (!s) return 0;
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  function ehCancelado(l) { return l.situacao === "Cancelado"; }
  function ativo(list) { return list.filter(function (l) { return !ehCancelado(l); }); }

  /* ---- tipos e classificação (v1.1) ----
     "Transferência" foi renomeado para "PIX" (os dados antigos continuam
     funcionando via ehPix/tipoBase e são migrados pelo store.js).
     Regra de contagem do PIX:
       • Situação "Recebido" → conta como RECEITA
       • Situação "Pago"     → conta como DESPESA
       • Situação "Pendente" → não entra nos totais (só em pendências) */
  function ehPix(tipo) { return tipo === "PIX" || tipo === "Transferência" || tipo === "Transferencia"; }
  function tipoBase(l) { return ehPix(l && l.tipo) ? "PIX" : (l && l.tipo); }
  function classificar(l) {
    if (!l || ehCancelado(l)) return null;
    if (l.tipo === "Receita") return "Receita";
    if (l.tipo === "Despesa") return "Despesa";
    if (ehPix(l.tipo)) {
      if (l.situacao === "Recebido") return "Receita";
      if (l.situacao === "Pago") return "Despesa";
      return null;
    }
    return null;
  }

  /* ================= toasts / confirmação ================= */
  function toast(msg, sub, tipo) {
    var box = $("#toasts");
    var t = el("div", "toast toast--" + (tipo || "ok"));
    t.innerHTML = "<div>" + esc(msg) + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</div>";
    box.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; t.style.transform = "translateX(30px)"; t.style.transition = ".3s"; }, 3400);
    setTimeout(function () { t.remove(); }, 3800);
  }

  function confirmar(msg, titulo) {
    return new Promise(function (res) {
      $("#confirmTitle").textContent = titulo || "Confirmar";
      $("#confirmMsg").textContent = msg;
      confirmCb = res;
      abrirModal("#modalConfirm");
    });
  }

  function abrirModal(sel) { var m = $(sel); m.classList.add("is-open"); m.setAttribute("aria-hidden", "false"); }
  function fecharModal(sel) {
    var m = $(sel); m.classList.remove("is-open"); m.setAttribute("aria-hidden", "true");
    if (sel === "#modalConfirm" && confirmCb) { confirmCb(false); confirmCb = null; }
  }

  /* ================= tema ================= */
  function aplicarTema(t) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("fincontrol.tema", t);
    $$("#segTema .seg__b").forEach(function (b) { b.classList.toggle("is-active", b.dataset.themeSet === t); });
    redesenharGraficos();
  }
  function temaAtual() { return document.documentElement.getAttribute("data-theme") || "light"; }

  /* ================= carregamento de libs CDN ================= */
  function carregarScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = src; s.async = true;
      s.onload = res; s.onerror = function () { rej(new Error(src)); };
      document.head.appendChild(s);
    });
  }

  /* ================= competência (seletor do topo) =================
     v1.1: lista apenas os meses que realmente possuem lançamentos
     (mais "Todo o período"), em ordem decrescente. */
  function montarSelectComp() {
    var sel = $("#selectComp");
    if (!sel) return;
    var meses = {};
    S.lanc.forEach(function (l) { var ym = ymDe(l.data); if (ym) meses[ym] = 1; });
    var lista = Object.keys(meses).sort().reverse();
    if (S.comp !== "todo" && lista.indexOf(S.comp) === -1) S.comp = "todo";
    sel.innerHTML = '<option value="todo">Todo o período</option>' +
      lista.map(function (ym) { return '<option value="' + ym + '">' + mesLabel(ym) + "</option>"; }).join("");
    sel.value = S.comp;
  }

  function montarSelectAno() {
    var sel = $("#selectAno");
    var anos = {};
    S.lanc.forEach(function (l) { if (l.data) anos[l.data.slice(0, 4)] = 1; });
    anos[ANOS.corrente] = 1; anos[ANOS.corrente - 1] = 1;
    var lista = Object.keys(anos).sort().reverse();
    if (lista.indexOf(String(S.anoRef)) === -1) lista.unshift(String(S.anoRef));
    sel.innerHTML = lista.map(function (a) { return '<option value="' + a + '">' + a + "</option>"; }).join("");
    sel.value = String(S.anoRef);
  }

  /* ================= seleção de período ================= */
  function lancPeriodo() {
    if (S.comp === "todo") return S.lanc;
    return S.lanc.filter(function (l) { return ymDe(l.data) === S.comp; });
  }
  function periodoTexto() {
    if (S.comp === "todo") return "todo o período";
    return mesExt(S.comp);
  }
  function totaisDo(list) {
    var r = 0, d = 0;
    ativo(list).forEach(function (l) {
      var c = classificar(l);
      if (c === "Receita") r += Number(l.valor) || 0;
      else if (c === "Despesa") d += Number(l.valor) || 0;
    });
    return { receitas: r, despesas: d, saldo: r - d, taxa: r > 0 ? (r - d) / r : 0 };
  }
  function mesAnterior(ym) {
    if (ym === "todo") return null;
    var p = ym.split("-"), dt = new Date(Number(p[0]), Number(p[1]) - 2, 1);
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0");
  }

  /* ================= PAINEL ================= */
  function renderPainel() {
    var list = lancPeriodo();
    var t = totaisDo(list);
    var pend = ativo(list).filter(function (l) { return l.situacao === "Pendente"; });
    var pendValor = pend.reduce(function (a, l) { return a + (Number(l.valor) || 0); }, 0);

    var antYM = mesAnterior(S.comp);
    var tAnt = antYM ? totaisDo(S.lanc.filter(function (l) { return ymDe(l.data) === antYM; })) : null;

    var kpis = $("#kpis");
    kpis.innerHTML = "";

    kpis.appendChild(kpi({
      classe: "kpi--green", icone: "↑", label: "Receitas · " + periodoTexto(), valor: t.receitas,
      rodape: variação(t.receitas, tAnt && tAnt.receitas, antYM)
    }));
    kpis.appendChild(kpi({
      classe: "kpi--red", icone: "↓", label: "Despesas · " + periodoTexto(), valor: t.despesas,
      rodape: variação(t.despesas, tAnt && tAnt.despesas, antYM, true)
    }));
    kpis.appendChild(kpi({
      classe: "kpi--blue", icone: "↔", label: "Saldo · " + periodoTexto(), valor: t.saldo,
      rodape: "<span class='muted'>Receitas − despesas</span>", cor: t.saldo < 0 ? "neg" : "pos"
    }));
    // v1.2: saldo consolidado de todas as contas e carteiras
    var consol = saldoConsolidado();
    kpis.appendChild(kpi({
      classe: "kpi--purple", icone: "◎", label: "Saldo consolidado", valor: consol,
      rodape: "<span class='muted'>" + S.contas.length + " conta(s) · saldo inicial + movimentações</span>",
      cor: consol < 0 ? "neg" : "pos"
    }));
    // v1.1: o card de juros saiu da linha de KPIs e passou a vir depois de Pendências
    atualizarJuros();

    // rodapé extra: ano + pendências + taxa de poupança (movida p/ chips na v1.1) + streak (v1.2)
    var tAno = totaisDo(S.lanc.filter(function (l) { return l.data && l.data.slice(0, 4) === String(S.anoRef); }));
    var streak = streakDias();
    var resumo = el("div", "chips");
    resumo.innerHTML =
      chip("Ano " + S.anoRef + " · receitas", brl(tAno.receitas)) +
      chip("Ano " + S.anoRef + " · despesas", brl(tAno.despesas)) +
      chip("Ano " + S.anoRef + " · saldo", brl(tAno.saldo), tAno.saldo < 0 ? "neg" : "pos") +
      chip("Taxa de poupança · " + periodoTexto(), (t.taxa * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%") +
      chip("Pendências (" + pend.length + ")", brl(pendValor)) +
      (streak >= 2 ? chip("🔥 Sequência de registros", streak + " dias seguidos") : "");
    var antigo = $("#kpis ~ .chips");
    if (antigo) antigo.remove();
    kpis.insertAdjacentElement("afterend", resumo);

    // gráficos
    var serie = serie12();
    $("#chartFluxoSub").textContent = "Receitas × despesas · " + serie[0].label + " a " + serie[serie.length - 1].label;
    window.Charts.fluxo($("#chartFluxo"), serie);

    var cats = despesasPorCategoria(list);
    $("#chartCatSub").textContent = "Despesas em " + periodoTexto();
    window.Charts.donut($("#chartCategorias"), cats.slice(0, 8));
    renderCatList(cats);

    // últimos lançamentos
    var ultimos = S.lanc.slice().sort(function (a, b) { return (b.data || "").localeCompare(a.data || ""); }).slice(0, 5);
    renderRows($("#ultimosList"), ultimos, true);

    // pendências (do período selecionado, coerente com o KPI)
    var pList = ativo(list).filter(function (l) { return l.situacao === "Pendente"; })
      .sort(function (a, b) { return (a.data || "").localeCompare(b.data || ""); }).slice(0, 6);
    $("#pendCount").textContent = pend.length;
    renderRows($("#pendList"), pList, true);

    // v1.1: ritmo do mês + maiores despesas
    renderRitmo(list);
    renderMaiores(list);

    // v1.2: evolução do saldo (12 meses) + orçamento do mês
    var evolucao = serieEvolucao();
    $("#evolucaoSub").textContent = S.lanc.length && evolucao.length
      ? "Saldo acumulado · " + evolucao[0].label + " a " + evolucao[evolucao.length - 1].label
      : "Saldo acumulado nos últimos 12 meses";
    window.Charts.linha($("#chartEvolucao"), evolucao);
    renderOrcamento(list);

    renderResumoAnual();
  }

  /* ================= CARD · MELHORES JUROS DO DIA (v1.1) =================
     Substitui o KPI "Taxa de poupança" (que passou para os chips).
     Traz as taxas do dia calculadas a partir das séries oficiais do
     Banco Central (SGS): 432 = meta Selic anual, 12 = CDI diário e
     195 = rendimento da poupança (30 dias). Guarda em localStorage por
     dia e, se o BCB/estiver fora do ar, mostra valores de referência. */
  var CHAVE_JUROS = "fincontrol.juros.v2"; // v2: invalida caches gravados com o cálculo antigo
  var jurosPromessa = null;

  function hojeISO() { return new Date().toISOString().slice(0, 10); }

  function comTimeout(p, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error("timeout")); }, ms);
      p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }

  function sgs(id, qtd) {
    var url = "https://api.bcb.gov.br/dados/serie/bcdata.sgs." + id + "/dados/ultimos/" + qtd + "?formato=json";
    // o BCB às vezes responde sem cabeçalho CORS (bloqueado pelo navegador) — repetimos a chamada
    function tentar(n) {
      return fetch(url, { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("SGS " + id + " · HTTP " + r.status);
        return r.json();
      }).catch(function (e) {
        if (n <= 0) throw e;
        return new Promise(function (res) { setTimeout(res, 500 * n); }).then(function () { return tentar(n - 1); });
      });
    }
    return tentar(2); // até 3 tentativas
  }

  function dataBrParaISO(s) {
    var p = String(s || "").split("/");
    return p.length === 3 ? p[2] + "-" + p[1] + "-" + p[0] : "";
  }

  function montarJuros(selic, cdi, poupanca, ref) {
    var itens = [
      { nome: "CDB · 100% do CDI", detalhe: "liquidez diária", taxa: cdi },
      { nome: "Tesouro Selic", detalhe: "D+1 · baixo risco", taxa: selic - 0.10, aprox: true },
      { nome: "LCI / LCA · 95% do CDI", detalhe: "isento de IR · carência 90 dias", taxa: cdi * 0.95 },
      { nome: "Poupança", detalhe: "isenta de IR · 0,5% ao mês + TR", taxa: poupanca }
    ].filter(function (i) { return i.taxa != null && i.taxa > 0; })
      .sort(function (a, b) { return b.taxa - a.taxa; });
    return { itens: itens, selic: selic, cdi: cdi, poupanca: poupanca, ref: ref || "", off: false };
  }

  function jurosFallback() {
    // valores de referência (Selic 13,75% · CDI 13,65% · poupança ≈8,3%) — out/2026
    var d = montarJuros(13.75, 13.65, 8.30, "referência out/2026");
    d.off = true; // sinaliza "modo offline" no rodapé do card
    return d;
  }

  function buscarJurosBCB() {
    // atenção: a série 432 do SGS aceita no máximo "ultimos/20" (mais que isso retorna HTTP 400)
    return comTimeout(Promise.all([sgs(432, 20), sgs(12, 5), sgs(195, 5)]), 7000).then(function (res) {
      var hoje = hojeISO();
      // as séries do SGS chegam em ordens diferentes (432/12 ascendente, 195 descendente):
      // escolhemos sempre a LINHA DE MAIOR DATA que não seja futura.
      function ultimoValido(lista) {
        var melhor = null;
        (lista || []).forEach(function (i) {
          var iso = dataBrParaISO(i.data);
          if (!iso || iso > hoje) return;
          if (!melhor || iso > melhor.iso) melhor = { iso: iso, data: i.data, valor: i.valor };
        });
        return melhor;
      }
      var mSelic = ultimoValido(res[0]), mCdi = ultimoValido(res[1]), mPoup = ultimoValido(res[2]);
      var selic = mSelic ? Number(mSelic.valor) : NaN;
      var cdiDia = mCdi ? Number(mCdi.valor) : NaN;
      if (isNaN(selic) || isNaN(cdiDia)) throw new Error("taxas indisponíveis");
      var cdi = (Math.pow(1 + cdiDia / 100, 252) - 1) * 100;
      var pm = mPoup ? Number(mPoup.valor) : NaN;
      var poupanca = (!isNaN(pm) && pm >= 0.4 && pm <= 0.9)
        ? (Math.pow(1 + pm / 100, 12) - 1) * 100 : null;
      return montarJuros(selic, cdi, poupanca, mCdi ? mCdi.data : (mSelic ? mSelic.data : ""));
    });
  }

  function jurosDoDia() {
    var cache = null;
    try { cache = JSON.parse(localStorage.getItem(CHAVE_JUROS) || "null"); } catch (e) { cache = null; }
    if (cache && cache.dia === hojeISO() && cache.itens && cache.itens.length) return Promise.resolve(cache);
    if (jurosPromessa) return jurosPromessa;
    jurosPromessa = buscarJurosBCB().then(function (d) {
      jurosPromessa = null;
      d.dia = hojeISO();
      try { localStorage.setItem(CHAVE_JUROS, JSON.stringify(d)); } catch (e) { /* storage cheio */ }
      return d;
    });
    return jurosPromessa;
  }

  function atualizarJuros() {
    jurosDoDia().then(pintarJuros).catch(function () { pintarJuros(jurosFallback()); });
  }

  function pctBR(v) { return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%"; }

  function pintarJuros(d) {
    var lista = $("#jurosLista");
    if (!lista || !d || !d.itens || !d.itens.length) return;
    var melhor = d.itens[0];
    var v = $("#jurosMelhor");
    if (v) v.textContent = pctBR(melhor.taxa) + " a.a.";
    var sub = $("#jurosSub");
    if (sub) sub.textContent = "Melhor hoje: " + melhor.nome + " · taxas oficiais do Banco Central";
    lista.innerHTML = d.itens.map(function (i) {
      return "<li>" +
        "<span class='juros__nome'>" + esc(i.nome) + (i.aprox ? " <em>≈</em>" : "") +
        "<small>" + esc(i.detalhe) + "</small></span>" +
        "<b>" + pctBR(i.taxa) + "</b></li>";
    }).join("");
    var fonte = $("#jurosFonte");
    if (fonte) fonte.innerHTML = "<span class='muted small'>Fonte: Banco Central — Selic " +
      esc(pctBR(d.selic)) + " · CDI " + esc(pctBR(d.cdi)) +
      (d.ref ? " · " + esc(d.ref) : "") +
      (d.off ? " · <b>modo offline</b>" : "") +
      " · estimativas antes de IR/IOF</span>";
  }

  /* ================= CARD · RITMO DO MÊS (v1.1) ================= */
  function metrica(rotulo, valor, nota) {
    return "<div class='metrica'><span>" + esc(rotulo) +
      (nota ? "<small>" + esc(nota) + "</small>" : "") + "</span><b>" + valor + "</b></div>";
  }

  function renderRitmo(list) {
    var box = $("#ritmoBox");
    if (!box) return;
    var ym = S.comp !== "todo" ? S.comp : ymHoje();
    var p = ym.split("-");
    var ano = Number(p[0]), mes = Number(p[1]);
    var diasNoMes = new Date(ano, mes, 0).getDate();
    var ehMesAtual = ym === ymHoje();
    var decorridos = ehMesAtual ? new Date().getDate() : diasNoMes;

    var desp = ativo(list).filter(function (l) { return classificar(l) === "Despesa"; })
      .reduce(function (a, l) { return a + (Number(l.valor) || 0); }, 0);
    var media = desp / Math.max(1, decorridos);
    var projecao = media * diasNoMes;

    var antYM = mesAnterior(ym);
    var despAnt = antYM ? ativo(S.lanc.filter(function (l) { return ymDe(l.data) === antYM; }))
      .filter(function (l) { return classificar(l) === "Despesa"; })
      .reduce(function (a, l) { return a + (Number(l.valor) || 0); }, 0) : null;
    var mediaAnt = despAnt == null ? null : despAnt / diasNoMes;

    $("#ritmoSub").textContent = ehMesAtual
      ? "Ritmo de " + mesExt(ym) + " (até hoje)"
      : "Fechamento de " + mesExt(ym);

    var cmp = mediaAnt == null || mediaAnt === 0
      ? "<span class='muted small'>sem base anterior</span>"
      : variação(media, mediaAnt, antYM, true);

    box.innerHTML =
      metrica("Gasto médio por dia", esc(brl(media))) +
      metrica(ehMesAtual ? "Dias decorridos" : "Dias do mês", decorridos + " de " + diasNoMes) +
      metrica("Projeção do fechamento", esc(brl(projecao)), "no ritmo atual · " + esc(brl(media)) + "/dia") +
      "<div class='metrica'><span>Ritmo vs " + esc(mesLabel(antYM || "")) + "</span><b>" + cmp + "</b></div>";
  }

  /* ================= CARD · MAIORES DESPESAS (v1.1) ================= */
  function renderMaiores(list) {
    var box = $("#maioresList");
    if (!box) return;
    var top = ativo(list).filter(function (l) { return classificar(l) === "Despesa"; })
      .sort(function (a, b) { return (Number(b.valor) || 0) - (Number(a.valor) || 0); })
      .slice(0, 5);
    $("#maioresSub").textContent = "Maiores valores · " + periodoTexto();
    renderRows(box, top, true);
  }

  /* ================= v1.2 · CONTAS, SALDO CONSOLIDADO, STREAK ================= */
  function isoLocal(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function saldoConta(nome) {
    var inicial = 0;
    S.contas.forEach(function (c) { if (c.nome === nome) inicial = Number(c.saldoInicial) || 0; });
    return ativo(S.lanc).reduce(function (a, l) {
      if ((l.conta || "") !== nome) return a;
      var cl = classificar(l);
      if (cl === "Receita") return a + (Number(l.valor) || 0);
      if (cl === "Despesa") return a - (Number(l.valor) || 0);
      return a;
    }, inicial);
  }
  function saldoConsolidado() {
    var base = S.contas.reduce(function (a, c) { return a + (Number(c.saldoInicial) || 0); }, 0);
    return ativo(S.lanc).reduce(function (a, l) {
      var cl = classificar(l);
      if (cl === "Receita") return a + (Number(l.valor) || 0);
      if (cl === "Despesa") return a - (Number(l.valor) || 0);
      return a;
    }, base);
  }
  function streakDias() {
    var dias = {};
    S.lanc.forEach(function (l) { if (l.data) dias[l.data] = true; });
    var d = new Date();
    if (!dias[isoLocal(d)]) d.setDate(d.getDate() - 1); // aceita "hoje ou ontem"
    var n = 0;
    while (dias[isoLocal(d)]) { n++; d.setDate(d.getDate() - 1); if (n > 400) break; }
    return n;
  }

  function renderContas() {
    var box = $("#contasGrid");
    $("#contasCount").textContent = S.contas.length + " conta(s)";
    if (!S.contas.length) {
      box.innerHTML = "<p class='muted small'>Nenhuma conta cadastrada ainda — crie a primeira no formulário desta página.</p>";
      return;
    }
    box.innerHTML = S.contas.map(function (c) {
      var saldo = saldoConta(c.nome);
      var qtd = ativo(S.lanc).filter(function (l) { return (l.conta || "") === c.nome; }).length;
      return "<div class='conta'>" +
        "<div class='conta__top'><span class='conta__nome'><i style='background:" + esc(c.cor || "#6366f1") + "'></i>" + esc(c.nome) + "</span>" +
        "<span class='badge'>" + esc(c.tipo || "—") + "</span></div>" +
        "<p class='muted small'>" + esc(c.banco || "—") + " · " + qtd + " lançamento(s)</p>" +
        "<p class='conta__saldo " + (saldo < 0 ? "neg" : "pos") + "'>" + brl(saldo) + "</p>" +
        (Number(c.saldoInicial) ? "<p class='muted small'>Inclui saldo inicial de " + brl(c.saldoInicial) + "</p>" : "") +
        "<div class='conta__acoes'>" +
          "<button class='mini' data-editconta='" + esc(c.id) + "' title='Editar'>✎</button> " +
          "<button class='mini mini--del' data-delconta='" + esc(c.id) + "' title='Excluir'>🗑</button>" +
        "</div></div>";
    }).join("") +
      "<div class='conta conta--total'><span class='conta__nome'>💰 Consolidado</span>" +
      "<p class='conta__saldo " + (saldoConsolidado() < 0 ? "neg" : "pos") + "'>" + brl(saldoConsolidado()) + "</p>" +
      "<p class='muted small'>Saldo inicial somado + receitas − despesas de todas as contas (inclui lançamentos sem conta).</p></div>";
  }

  function limparFormConta() {
    S.contaEditId = null;
    var f = $("#formConta");
    f.reset();
    f.cor.value = "#6366f1";
    $("#contaFormTitle").textContent = "Nova conta";
    $("#btnSalvarConta").textContent = "Adicionar conta";
    $("#formContaError").classList.add("is-hidden");
  }
  function salvarConta(ev) {
    ev.preventDefault();
    var f = $("#formConta");
    var erro = $("#formContaError");
    var nome = f.nome.value.trim();
    if (!nome) return mostrarErro(erro, "Informe o nome da conta.");
    var duplicada = S.contas.some(function (c) {
      return c.id !== S.contaEditId && normalizarTxt(c.nome) === normalizarTxt(nome);
    });
    if (duplicada) return mostrarErro(erro, "Já existe uma conta com este nome.");
    var dados = {
      nome: nome, banco: f.banco.value.trim(), tipo: f.tipo.value,
      saldoInicial: Math.round(parseValor(f.saldoInicial.value) * 100) / 100, cor: f.cor.value
    };
    var prom = S.contaEditId ? Store.updateConta(S.contaEditId, dados) : Store.addConta(dados);
    prom.then(function () {
      toast(S.contaEditId ? "Conta atualizada" : "Conta adicionada", nome, "ok");
      limparFormConta();
      renderTudo();
    }).catch(function (e) { mostrarErro(erro, (e && e.message) || "Não foi possível salvar."); });
  }

  /* ================= v1.2 · EVOLUÇÃO DO SALDO ================= */
  function serieEvolucao() {
    if (!S.lanc.length) return [];
    var base = new Date();
    var meses = [];
    for (var i = 11; i >= 0; i--) {
      var m = new Date(base.getFullYear(), base.getMonth() - i, 1);
      meses.push(m.getFullYear() + "-" + String(m.getMonth() + 1).padStart(2, "0"));
    }
    var porMes = {};
    ativo(S.lanc).forEach(function (l) {
      if (!l.data) return;
      var cl = classificar(l);
      var v = cl === "Receita" ? (Number(l.valor) || 0) : (cl === "Despesa" ? -(Number(l.valor) || 0) : 0);
      if (!v) return;
      var ym = ymDe(l.data);
      porMes[ym] = (porMes[ym] || 0) + v;
    });
    var yms = Object.keys(porMes).sort();
    var acum = 0, idx = 0;
    return meses.map(function (ym) {
      while (idx < yms.length && yms[idx] <= ym) { acum += porMes[yms[idx]]; idx++; }
      return { label: mesLabel(ym), valor: Math.round(acum * 100) / 100 };
    });
  }

  /* ================= v1.2 · ORÇAMENTO MENSAL ================= */
  var orcAlertas = {};
  function renderOrcamento(list) {
    var box = $("#orcamentoBox");
    if (!box) return;
    var linhas = S.cats.map(function (c) {
      var lim = Number(c.orcamento) || 0;
      if (lim <= 0 || (c.tipo || "Despesa") === "Receita") return null;
      var gasto = 0;
      list.forEach(function (l) {
        if (l.categoria !== c.nome) return;
        if (classificar(l) !== "Despesa") return;
        gasto += Number(l.valor) || 0;
      });
      return { cat: c, lim: lim, gasto: gasto };
    }).filter(Boolean);

    $("#orcamentoSub").textContent = linhas.length
      ? "Orçado × realizado · " + periodoTexto()
      : "Defina limites por categoria em Categorias";
    if (!linhas.length) {
      box.innerHTML = "<p class='muted small'>Nenhum orçamento definido. Vá em <a class='link' href='#/categorias'>Categorias</a> e informe um limite mensal por categoria para acompanhar aqui o orçado × realizado.</p>";
      return;
    }
    box.innerHTML = linhas.map(function (o) {
      var pct = o.lim > 0 ? Math.round((o.gasto / o.lim) * 100) : 0;
      var cls = pct >= 100 ? "orc--over" : (pct >= 80 ? "orc--warn" : "orc--ok");
      // alerta in-app 80% / 100% (uma vez por categoria, por sessão)
      if (pct >= 80 && !orcAlertas[o.cat.nome]) {
        orcAlertas[o.cat.nome] = true;
        toast(pct >= 100 ? "Orçamento estourado!" : "Atenção ao orçamento",
          o.cat.nome + ": " + brl(o.gasto) + " de " + brl(o.lim) + " (" + pct + "%)", "warn");
      }
      var estado = pct >= 100 ? "estourado" : (pct >= 80 ? "atenção" : "no tranco");
      return "<div class='orc'>" +
        "<div class='orc__top'><span><i style='background:" + esc(o.cat.cor || "#6366f1") + "'></i>" + esc(o.cat.nome) + "</span>" +
        "<span class='orc__val " + cls + "'>" + brl(o.gasto) + " de " + brl(o.lim) + " · <strong>" + pct + "% · " + estado + "</strong></span></div>" +
        "<div class='orc__bar'><div class='orc__fill " + cls + "' style='width:" + Math.min(pct, 100) + "%'></div></div>" +
        "</div>";
    }).join("");
  }

  function renderOrcamentosCfg() {
    var box = $("#orcamentosCfg");
    if (!box) return;
    var cats = S.cats.filter(function (c) { return (c.tipo || "Despesa") !== "Receita"; });
    if (!cats.length) { box.innerHTML = "<p class='muted small'>Crie categorias de despesa para definir orçamentos.</p>"; return; }
    box.innerHTML = "<div class='orc-cfg'>" + cats.map(function (c) {
      var v = Number(c.orcamento) || 0;
      return "<div class='orc-cfg__row'>" +
        "<span><i style='background:" + esc(c.cor || "#6366f1") + "'></i>" + esc(c.nome) + "</span>" +
        "<label class='orc-cfg__input'>R$ <input type='number' min='0' step='0.01' inputmode='decimal' class='input-sm' data-orc='" + esc(c.id) + "' placeholder='sem limite' value='" + (v > 0 ? v : "") + "'></label>" +
        "</div>";
    }).join("") + "</div>";
  }

  /* ================= v1.2 · SUGESTÃO AUTOMÁTICA DE CATEGORIA ================= */
  var mapaSug = null, mapaSugRef = null;
  function normalizarTxt(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function tokenizar(s) {
    return normalizarTxt(s).split(/[^a-z0-9]+/).filter(function (t) { return t.length >= 3; });
  }
  function mapaSugestao() {
    if (mapaSugRef === S.lanc && mapaSug) return mapaSug;
    mapaSugRef = S.lanc; mapaSug = {};
    S.lanc.forEach(function (l) {
      if (!l.categoria || !l.descricao) return;
      var vistos = {};
      tokenizar(l.descricao).forEach(function (t) {
        if (vistos[t]) return; vistos[t] = 1;
        var m = mapaSug[t] = (mapaSug[t] || {});
        m[l.categoria] = (m[l.categoria] || 0) + 1;
      });
    });
    return mapaSug;
  }
  function sugerirCategoria(texto) {
    var mapa = mapaSugestao();
    var toks = tokenizar(texto);
    if (!toks.length) return null;
    var pont = {};
    toks.forEach(function (t) {
      var m = mapa[t]; if (!m) return;
      var total = 0; for (var c in m) total += m[c];
      for (var cat in m) pont[cat] = (pont[cat] || 0) + (m[cat] / total);
    });
    var melhor = null, melhorV = 0;
    for (var cat in pont) if (pont[cat] > melhorV) { melhorV = pont[cat]; melhor = cat; }
    return melhorV >= 0.6 ? melhor : null; // exige alguma confiança
  }
  var tSug = null;
  function agendarSugestao() { clearTimeout(tSug); tSug = setTimeout(atualizarSugestao, 280); }
  function atualizarSugestao() {
    var box = $("#sugestaoCat");
    if (!box) return;
    var f = $("#formLanc");
    var cat = sugerirCategoria(f.descricao.value);
    if (cat && cat !== f.categoria.value) {
      box.classList.remove("is-hidden");
      box.innerHTML = "💡 Sugestão pelo seu histórico: <button type='button' class='sug-btn' data-sug='" + esc(cat) + "'>usar <strong>" + esc(cat) + "</strong></button>";
    } else {
      box.classList.add("is-hidden");
    }
  }

  /* ================= v1.2 · LANÇAMENTOS RECORRENTES ================= */
  /* Gera automaticamente os meses seguintes (até o mês atual) para itens
     marcados como "Repetir todo mês". Duplicatas são evitadas por
     mês + descrição + valor + conta. */
  function gerarRecorrentes() {
    if (!S.user || !S.lanc.length) return;
    var ymAtual = ymHoje();
    var existentes = {};
    S.lanc.forEach(function (l) {
      if (l.recorrencia !== "mensal" || !l.data) return;
      existentes[[ymDe(l.data), l.descricao, (Number(l.valor) || 0).toFixed(2), l.conta || ""].join("|")] = true;
    });
    var novos = [];
    S.lanc.forEach(function (l) {
      if (l.recorrencia !== "mensal" || !l.data || l.data.length < 10) return;
      var dia = Math.min(Number(l.data.slice(8, 10)) || 1, 28);
      var base = new Date(Number(l.data.slice(0, 4)), Number(l.data.slice(5, 7)) - 1, 1);
      for (var i = 1; i <= 24; i++) {
        var prox = new Date(base.getFullYear(), base.getMonth() + i, 1);
        var ym = prox.getFullYear() + "-" + String(prox.getMonth() + 1).padStart(2, "0");
        if (ym > ymAtual) break;
        var k = [ym, l.descricao, (Number(l.valor) || 0).toFixed(2), l.conta || ""].join("|");
        if (existentes[k]) continue;
        existentes[k] = true;
        var ultimoDia = new Date(prox.getFullYear(), prox.getMonth() + 1, 0).getDate();
        novos.push({
          data: ym + "-" + String(Math.min(dia, ultimoDia)).padStart(2, "0"),
          tipo: l.tipo, categoria: l.categoria, descricao: l.descricao, valor: l.valor,
          situacao: l.situacao === "Cancelado" ? "Cancelado" : "Pendente",
          observacoes: l.observacoes || "", conta: l.conta || "", recorrencia: "mensal"
        });
      }
    });
    if (!novos.length) return;
    // usa addLancamento (e não importar) para não prefixar "Importado" nas observações
    Promise.all(novos.map(function (n) { return Store.addLancamento(n); })).then(function () {
      toast("Recorrentes gerados", novos.length + " lançamento(s) mensal(is) criado(s) até " + mesExt(ymHoje()) + ".", "ok");
    }).catch(function () { /* silencioso: tenta de novo no próximo acesso */ });
  }

  /* ================= v1.2 · METAS / CAIXINHAS ================= */
  function metaAportado(m) {
    return (m.aportes || []).reduce(function (a, x) { return a + (Number(x.valor) || 0); }, 0);
  }
  function renderMetas() {
    var box = $("#metasGrid");
    if (!box) return;
    if (!S.metas.length) {
      box.innerHTML = "<div class='empty'><div class='empty__ico'>🎯</div><h2>Nenhuma meta ainda</h2>" +
        "<p>Crie sua primeira meta: reserva de emergência, viagem, carro novo… Defina o valor alvo, o prazo e acompanhe o progresso.</p>" +
        "<button class='btn btn--primary' id='btnNovaMeta2'>+ Nova meta</button></div>";
      return;
    }
    box.innerHTML = S.metas.map(function (m) {
      var alvo = Number(m.alvo) || 0;
      var aportado = metaAportado(m);
      var pct = alvo > 0 ? Math.round((aportado / alvo) * 100) : 0;
      var aporte = Number(m.aporteMensal) || 0;
      var previsao = "";
      if (alvo > 0 && aportado >= alvo) previsao = "meta atingida! 🎉";
      else if (alvo > aportado && aporte > 0) {
        var meses = Math.ceil((alvo - aportado) / aporte);
        var d = new Date(); d.setMonth(d.getMonth() + meses);
        previsao = "previsão com aporte de " + brl(aporte) + "/mês: " + MES_CURTO[d.getMonth()] + "/" + d.getFullYear();
      }
      var prazoTxt = "";
      if (m.prazo) {
        var pp = String(m.prazo).split("-");
        prazoTxt = " · prazo " + pp[1] + "/" + pp[0];
        var restante = (Number(pp[0]) - new Date().getFullYear()) * 12 + (Number(pp[1]) - 1 - new Date().getMonth());
        if (alvo > aportado && restante >= 0 && aporte > 0) {
          var dPrec = Math.ceil((alvo - aportado) / aporte);
          previsao += dPrec > restante ? " ⚠️ (atrasada em ~" + (dPrec - restante) + " mês(es))" : " ✔️ (no tempo)";
        }
      }
      return "<div class='meta'>" +
        "<div class='meta__top'><strong><i style='background:" + esc(m.cor || "#6366f1") + "'></i>" + esc(m.nome) + "</strong>" +
        "<span class='meta__pct " + (pct >= 100 ? "pos" : "") + "'>" + pct + "%</span></div>" +
        "<div class='meta__bar'><div class='meta__fill' style='width:" + Math.min(pct, 100) + "%;background:" + esc(m.cor || "#6366f1") + "'></div></div>" +
        "<p class='muted small'>" + brl(aportado) + " de " + brl(alvo) + prazoTxt + (previsao ? " · " + esc(previsao) : "") + "</p>" +
        "<div class='conta__acoes'>" +
          "<button class='mini' data-aportar='" + esc(m.id) + "' title='Registrar aporte'>+ Aportar</button> " +
          "<button class='mini' data-editmeta='" + esc(m.id) + "' title='Editar'>✎</button> " +
          "<button class='mini mini--del' data-delmeta='" + esc(m.id) + "' title='Excluir'>🗑</button>" +
        "</div></div>";
    }).join("");
  }
  function abrirMetaModal(meta) {
    S.metaEditId = meta ? meta.id : null;
    var f = $("#formMeta");
    f.reset();
    $("#metaTitle").textContent = meta ? "Editar meta" : "Nova meta";
    $("#formMetaError").classList.add("is-hidden");
    if (meta) {
      f.nome.value = meta.nome || "";
      f.alvo.value = (Number(meta.alvo) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
      f.prazo.value = meta.prazo || "";
      f.aporte.value = meta.aporteMensal
        ? Number(meta.aporteMensal).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "";
      f.cor.value = meta.cor || "#6366f1";
    }
    abrirModal("#modalMeta");
    setTimeout(function () { f.nome.focus(); }, 60);
  }
  function salvarMeta(ev) {
    ev.preventDefault();
    var f = $("#formMeta");
    var erro = $("#formMetaError");
    var nome = f.nome.value.trim();
    var alvo = parseValor(f.alvo.value);
    if (!nome) return mostrarErro(erro, "Informe o nome da meta.");
    if (!alvo || alvo <= 0) return mostrarErro(erro, "Informe um valor alvo maior que zero.");
    var dados = {
      nome: nome, alvo: Math.round(alvo * 100) / 100, prazo: f.prazo.value || "",
      aporteMensal: Math.round(parseValor(f.aporte.value) * 100) / 100, cor: f.cor.value
    };
    var prom = S.metaEditId ? Store.updateMeta(S.metaEditId, dados) : Store.addMeta(dados);
    prom.then(function () {
      toast(S.metaEditId ? "Meta atualizada" : "Meta criada", nome, "ok");
      S.metaEditId = null;
      fecharModal("#modalMeta");
    }).catch(function (e) { mostrarErro(erro, (e && e.message) || "Não foi possível salvar."); });
  }
  function abrirAporteModal(meta) {
    if (!meta) return;
    S.aporteMetaId = meta.id;
    var f = $("#formAporte");
    f.reset();
    $("#aporteTitle").textContent = "Aportar em “" + meta.nome + "”";
    $("#formAporteError").classList.add("is-hidden");
    abrirModal("#modalAporte");
    setTimeout(function () { f.valor.focus(); }, 60);
  }
  function salvarAporte(ev) {
    ev.preventDefault();
    var f = $("#formAporte");
    var erro = $("#formAporteError");
    var v = parseValor(f.valor.value);
    if (!v || v <= 0) return mostrarErro(erro, "Informe um valor maior que zero.");
    var meta = S.metas.filter(function (m) { return m.id === S.aporteMetaId; })[0];
    if (!meta) return mostrarErro(erro, "Meta não encontrada.");
    var aportes = (meta.aportes || []).slice();
    aportes.push({ data: isoLocal(new Date()), valor: Math.round(v * 100) / 100 });
    Store.updateMeta(meta.id, { aportes: aportes }).then(function () {
      toast("Aporte registrado", meta.nome + " · " + brl(v), "ok");
      fecharModal("#modalAporte");
    }).catch(function (e) { mostrarErro(erro, (e && e.message) || "Não foi possível registrar."); });
  }

  /* ================= v1.2 · SIMULADORES ================= */
  function simularJuros(ev) {
    ev.preventDefault();
    var f = ev.target;
    var inicial = parseValor(f.inicial.value);
    var aporte = parseValor(f.aporte.value);
    var taxaMes = parseValor(f.taxaMes.value);
    var taxaAno = parseValor(f.taxaAno.value);
    if (!taxaMes && taxaAno) taxaMes = (Math.pow(1 + taxaAno / 100, 1 / 12) - 1) * 100;
    if (!taxaMes && !taxaAno) return toast("Informe a taxa", "Use % ao mês ou % ao ano.", "warn");
    var meses = Math.min(1200, Math.max(1, Number(f.meses.value) || 12));
    var ir = (parseValor(f.trib.value) || 0) / 100;

    var m = inicial, aportado = inicial;
    for (var i = 0; i < meses; i++) { m = (m + aporte) * (1 + taxaMes / 100); aportado += aporte; }
    var rendBruto = Math.max(0, m - aportado);
    var rendLiq = rendBruto * (1 - ir);
    var final = aportado + rendLiq;
    var taxaAnoEq = (Math.pow(1 + taxaMes / 100, 12) - 1) * 100;

    var box = $("#jurosResultado");
    box.classList.remove("is-hidden");
    box.innerHTML =
      "<div class='sim-res'>" +
        "<span class='muted small'>Montante final após " + meses + " mês(es)</span>" +
        "<strong class='sim-res__big pos'>" + brl(final) + "</strong>" +
        "<span class='muted small'>" + pctBR(taxaMes) + " ao mês · " + pctBR(taxaAnoEq) + " ao ano</span>" +
      "</div>" +
      "<div class='sim-grid'>" +
        "<div><span class='muted small'>Total aportado</span><strong>" + brl(aportado) + "</strong></div>" +
        "<div><span class='muted small'>Rendimento" + (ir > 0 ? " líquido de IR (" + pctBR(ir * 100) + ")" : "") + "</span><strong class='pos'>" + brl(rendLiq) + "</strong></div>" +
        (ir > 0 ? "<div><span class='muted small'>Sem IR seria</span><strong>" + brl(aportado + rendBruto) + "</strong></div>" : "") +
      "</div>";
  }

  function simularResgate(ev) {
    ev.preventDefault();
    var f = ev.target;
    var montante = parseValor(f.montante.value);
    var resgate = parseValor(f.resgate.value);
    var taxaAno = parseValor(f.taxaAno.value);
    if (!montante || montante <= 0) return toast("Informe o montante atual", "", "warn");
    if (resgate <= 0 || resgate > montante) return toast("Resgate inválido", "Informe um valor entre zero e o montante.", "warn");
    if (!taxaAno) return toast("Informe a taxa", "Ex.: 13,65 ao ano.", "warn");
    var meses = Math.min(1200, Math.max(1, Number(f.meses.value) || 12));
    var taxaMes = Math.pow(1 + taxaAno / 100, 1 / 12) - 1;
    var fator = Math.pow(1 + taxaMes, meses);
    var semResgate = montante * fator;                                   // cenário A: não saca
    var comResgate = (montante - resgate) * fator + resgate;             // cenário B: saca e guarda embaixo do colchão
    var deixou = semResgate - comResgate;                                // o que deixa de ganhar

    var box = $("#resgateResultado");
    box.classList.remove("is-hidden");
    box.innerHTML =
      "<div class='sim-grid'>" +
        "<div><span class='muted small'>Não sacando · em " + meses + " mês(es)</span><strong class='pos'>" + brl(semResgate) + "</strong></div>" +
        "<div><span class='muted small'>Sacando " + brl(resgate) + "</span><strong>" + brl(comResgate) + "</strong></div>" +
      "</div>" +
      "<div class='sim-res'>" +
        "<span class='muted small'>Sacando agora você deixa de ganhar</span>" +
        "<strong class='sim-res__big neg'>" + brl(deixou) + "</strong>" +
        "<span class='muted small'>E o valor sacado é " + brl(resgate) + " a menos no bolso no final do período.</span>" +
      "</div>";
  }

  function pendTotal() {
    return ativo(S.lanc).filter(function (l) { return l.situacao === "Pendente"; }).length;
  }

  function chip(nome, valor, cls) {
    return "<span class='chip'>" + esc(nome) + ": <b class='" + (cls || "") + "'>" + esc(valor) + "</b></span>";
  }

  function variação(atual, anterior, ym, inverso) {
    if (anterior == null || !ym) return "<span class='muted'>—" + (ym ? " · sem base anterior" : "") + "</span>";
    if (anterior === 0) return "<span class='muted'>sem base em " + mesLabel(ym) + "</span>";
    var pct = ((atual - anterior) / Math.abs(anterior)) * 100;
    var subiu = pct >= 0;
    var bom = inverso ? !subiu : subiu;
    var cls = Math.abs(pct) < 0.05 ? "" : (bom ? "tag--up" : "tag--down");
    var sinal = subiu ? "▲" : "▼";
    return "<span class='tag " + cls + "'>" + sinal + " " + Math.abs(pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%</span>" +
      "<span class='muted'>vs " + mesLabel(ym) + "</span>";
  }

  function kpi(o) {
    var e = el("div", "kpi " + o.classe);
    var valor = o.valor != null ? esc(brl(o.valor)) : esc(o.texto);
    e.innerHTML =
      "<div class='kpi__top'><span class='kpi__label'>" + esc(o.label) + "</span><span class='kpi__ico'>" + o.icone + "</span></div>" +
      "<div class='kpi__value " + (o.cor || "") + "'>" + valor + "</div>" +
      "<div class='kpi__foot'>" + (o.rodape || "") + "</div>";
    return e;
  }

  function serie12() {
    var fim = S.comp !== "todo" ? S.comp : ymHoje();
    var p = fim.split("-"), dt = new Date(Number(p[0]), Number(p[1]) - 1, 1);
    var out = [];
    for (var i = 11; i >= 0; i--) {
      var d = new Date(dt.getFullYear(), dt.getMonth() - i, 1);
      var ym = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      var r = 0, des = 0;
      ativo(S.lanc.filter(function (x) { return ymDe(x.data) === ym; })).forEach(function (l) {
        var c = classificar(l);
        if (c === "Receita") r += Number(l.valor) || 0;
        else if (c === "Despesa") des += Number(l.valor) || 0;
      });
      out.push({ label: MES_CURTO[d.getMonth()] + "/" + String(d.getFullYear()).slice(2), receitas: r, despesas: des, saldo: r - des });
    }
    return out;
  }

  function despesasPorCategoria(list) {
    var mapa = {}, cores = {};
    S.cats.forEach(function (c) { cores[c.nome] = c.cor; });
    ativo(list).forEach(function (l) {
      if (classificar(l) !== "Despesa") return;
      var k = l.categoria || "Outros";
      mapa[k] = (mapa[k] || 0) + (Number(l.valor) || 0);
    });
    var arr = Object.keys(mapa).map(function (k, i) {
      return { nome: k, valor: mapa[k], cor: cores[k] || window.Charts.PALETA[i % window.Charts.PALETA.length] };
    });
    arr.sort(function (a, b) { return b.valor - a.valor; });
    return arr;
  }

  function renderCatList(cats) {
    var box = $("#catList");
    if (!cats.length) { box.innerHTML = "<p class='muted small'>Nenhuma despesa no período selecionado.</p>"; return; }
    var total = cats.reduce(function (a, c) { return a + c.valor; }, 0) || 1;
    box.innerHTML = cats.slice(0, 6).map(function (c) {
      var pct = (c.valor / total) * 100;
      return "<div class='catlist__row'>" +
        "<span class='catlist__name'><i style='background:" + esc(c.cor) + "'></i><span>" + esc(c.nome) + "</span></span>" +
        "<span class='catlist__val'>" + esc(brl(c.valor)) + "</span>" +
        "<span class='catlist__bar'><b style='width:" + pct.toFixed(1) + "%;background:" + esc(c.cor) + "'></b></span>" +
        "</div>";
    }).join("");
  }

  function renderRows(box, list, comAcoes) {
    if (!list.length) {
      box.innerHTML = "<div class='empty' style='padding:26px 10px'><p class='muted'>Nada por aqui ainda.</p></div>";
      return;
    }
    box.innerHTML = list.map(function (l) {
      var c = classificar(l);
      var rec = c === "Receita";
      var ico = ehPix(l.tipo) ? "⚡" : (rec ? "💰" : "🧾");
      var sinal = rec ? "+" : (c === "Despesa" ? "−" : "");
      var valor = sinal + brl(Math.abs(Number(l.valor) || 0));
      return "<div class='rowl'>" +
        "<span class='rowl__ico'>" + ico + "</span>" +
        "<span class='rowl__txt'><strong>" + esc(l.descricao || l.categoria || "Sem descrição") + "</strong>" +
        "<small>" + esc((l.categoria || "—") + " · " + fmtData(l.data)) + "</small></span>" +
        "<span class='rowl__val " + (rec ? "pos" : (c === "Despesa" ? "neg" : "")) + "'>" + valor + "</span>" +
        (comAcoes ? "<span class='rowl__act'><button class='mini' data-edit='" + esc(l.id) + "' title='Editar'>✎</button></span>" : "") +
        "</div>";
    }).join("");
  }

  function renderResumoAnual() {
    $("#resumoSub").textContent = "Totais do ano de " + S.anoRef + " (lançamentos não cancelados)";
    var mapa = {}, cores = {};
    S.cats.forEach(function (c) { cores[c.nome] = c.cor; });
    ativo(S.lanc.filter(function (l) { return l.data && l.data.slice(0, 4) === String(S.anoRef); })).forEach(function (l) {
      var k = (classificar(l) || tipoBase(l) || "—") + "||" + (l.categoria || "Outros");
      mapa[k] = (mapa[k] || 0) + (Number(l.valor) || 0);
    });
    var porTipo = {};
    var linhas = Object.keys(mapa).map(function (k) {
      var p = k.split("||");
      porTipo[p[0]] = (porTipo[p[0]] || 0) + mapa[k];
      return { tipo: p[0], categoria: p[1], total: mapa[k] };
    }).sort(function (a, b) { return b.total - a.total; });

    var tbody = $("#tabelaResumo tbody");
    if (!linhas.length) {
      tbody.innerHTML = "<tr><td colspan='4' class='muted' style='text-align:center;padding:26px'>Sem lançamentos em " + S.anoRef + ".</td></tr>";
      return;
    }
    tbody.innerHTML = linhas.map(function (l) {
      var base = porTipo[l.tipo] || 1;
      var pct = (l.total / base) * 100;
      var cor = l.tipo === "Receita" ? "var(--green)" : (l.tipo === "PIX" ? "var(--blue)" : "var(--red)");
      var textoPct = l.tipo === "PIX" ? "% dos pix" : "% das " + esc(l.tipo.toLowerCase()) + "s";
      return "<tr>" +
        "<td><span class='catlist__name'><i style='background:" + esc(cores[l.categoria] || cor) + "'></i><span>" + esc(l.categoria) + "</span></span></td>" +
        "<td><span class='badge badge--" + esc(l.tipo) + "'>" + esc(l.tipo) + "</span></td>" +
        "<td class='num'>" + esc(brl(l.total)) + "</td>" +
        "<td><span class='barcell'><b style='width:" + pct.toFixed(1) + "%;background:" + cor + "'></b></span>" +
        "<span class='small muted'> " + pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + textoPct + "</span></td>" +
        "</tr>";
    }).join("");
  }

  function redesenharGraficos() {
    if (!S.user || $("#view-painel").classList.contains("is-hidden")) return;
    window.Charts.destroyAll();
    renderPainel();
  }

  /* ================= LANÇAMENTOS ================= */
  function filtrados() {
    var q = S.busca.trim().toLowerCase();
    var list = S.comp === "todo" ? S.lanc.slice() : S.lanc.filter(function (l) { return ymDe(l.data) === S.comp; });
    list = list.filter(function (l) {
      if (S.tipo && tipoBase(l) !== S.tipo) return false;
      if (S.cat && l.categoria !== S.cat) return false;
      if (S.sit && l.situacao !== S.sit) return false;
      // v1.2: filtro por conta/carteira
      if (S.conta) {
        if (S.conta === SEMCONTA ? !!l.conta : l.conta !== S.conta) return false;
      }
      // v1.1: filtro de período personalizado (combina com a competência)
      var d = l.data || "";
      if (S.de && d && d < S.de) return false;
      if (S.ate && d && d > S.ate) return false;
      if (q) {
        var alvo = [l.descricao, l.categoria, l.observacoes, l.situacao, tipoBase(l), l.conta].join(" ").toLowerCase();
        if (alvo.indexOf(q) === -1) return false;
      }
      return true;
    });
    // v1.1: ordenação selecionável
    var ordenacoes = {
      "data-desc": function (a, b) {
        var d = (b.data || "").localeCompare(a.data || "");
        return d !== 0 ? d : (b.criadoEm || "").localeCompare(a.criadoEm || "");
      },
      "data-asc": function (a, b) {
        var d = (a.data || "").localeCompare(b.data || "");
        return d !== 0 ? d : (a.criadoEm || "").localeCompare(b.criadoEm || "");
      },
      "valor-desc": function (a, b) { return (Number(b.valor) || 0) - (Number(a.valor) || 0); },
      "valor-asc": function (a, b) { return (Number(a.valor) || 0) - (Number(b.valor) || 0); },
      "desc-az": function (a, b) { return String(a.descricao || "").localeCompare(String(b.descricao || ""), "pt-BR"); }
    };
    return list.sort(ordenacoes[S.ordem] || ordenacoes["data-desc"]);
  }

  function renderTabela() {
    var list = filtrados();
    var porPagina = CFG.porPagina || 15;
    var totalPag = Math.max(1, Math.ceil(list.length / porPagina));
    if (S.pag > totalPag) S.pag = totalPag;
    var ini = (S.pag - 1) * porPagina;
    var pagina = list.slice(ini, ini + porPagina);

    var receitas = 0, despesas = 0, pend = 0;
    ativo(list).forEach(function (l) {
      var c = classificar(l);
      if (c === "Receita") receitas += Number(l.valor) || 0;
      else if (c === "Despesa") despesas += Number(l.valor) || 0;
      if (l.situacao === "Pendente") pend++;
    });
    $("#resumoChips").innerHTML =
      chip("Receitas", brl(receitas)) +
      chip("Despesas", brl(despesas)) +
      chip("Saldo", brl(receitas - despesas), receitas - despesas < 0 ? "neg" : "pos") +
      chip("Pendentes", String(pend));

    var txtPeriodo = (S.de || S.ate)
      ? "Período: " + (S.de ? fmtData(S.de) : "início") + " → " + (S.ate ? fmtData(S.ate) : "hoje")
      : "";
    $("#filtroPeriodoTxt").textContent = txtPeriodo;

    var tbody = $("#tabelaLanc tbody");
    tbody.innerHTML = pagina.map(function (l) {
      var c = classificar(l);
      var tb = tipoBase(l) || l.tipo;
      var sinal = c === "Receita" ? "+" : (c === "Despesa" ? "−" : "");
      var cls = c === "Receita" ? "pos" : (c === "Despesa" ? "neg" : "");
      return "<tr>" +
        "<td class='data-cell'>" + fmtData(l.data) + "</td>" +
        "<td><span class='badge badge--" + esc(tb) + "'>" + esc(tb) + "</span></td>" +
        "<td>" + esc(l.categoria || "—") + "</td>" +
        "<td class='desc-cell'><strong>" + esc(l.descricao || "—") + "</strong>" +
          (function () {
            var extras = [];
            if (l.observacoes) extras.push(esc(l.observacoes));
            if (l.conta) extras.push("🏦 " + esc(l.conta));
            if (l.recorrencia === "mensal") extras.push("🔁 mensal");
            return extras.length ? "<small>" + extras.join(" · ") + "</small>" : "";
          })() + "</td>" +
        "<td class='num " + cls + "'>" + sinal + " " + esc(brl(l.valor)) + "</td>" +
        "<td><span class='st st--" + esc(l.situacao || "Pendente") + "'>" + esc(l.situacao || "—") + "</span></td>" +
        "<td class='td-acoes'>" +
          "<button class='mini' data-edit='" + esc(l.id) + "' title='Editar'>✎</button> " +
          "<button class='mini mini--del' data-del='" + esc(l.id) + "' title='Excluir'>🗑</button>" +
        "</td></tr>";
    }).join("");

    $("#lancEmpty").classList.toggle("is-hidden", list.length > 0);
    $("#tabelaLanc").classList.toggle("is-hidden", list.length === 0);

    // paginação
    var pager = $("#pager");
    if (list.length <= porPagina) {
      pager.innerHTML = "<span class='pager__info'>" + list.length + " lançamento(s)</span>";
    } else {
      var botoes = "";
      for (var p = 1; p <= totalPag; p++) {
        if (totalPag > 7 && p !== 1 && p !== totalPag && Math.abs(p - S.pag) > 1) {
          if (p === 2 || p === totalPag - 1) botoes += "<span class='pager__info'>…</span>";
          continue;
        }
        botoes += "<button class='pg " + (p === S.pag ? "is-active" : "") + "' data-pag='" + p + "'>" + p + "</button>";
      }
      pager.innerHTML =
        "<span class='pager__info'>Mostrando " + (ini + 1) + "–" + Math.min(ini + porPagina, list.length) + " de " + list.length + "</span>" +
        "<span class='pager__btns'>" +
        "<button class='pg' data-pag='" + (S.pag - 1) + "' " + (S.pag === 1 ? "disabled" : "") + ">‹</button>" +
        botoes +
        "<button class='pg' data-pag='" + (S.pag + 1) + "' " + (S.pag === totalPag ? "disabled" : "") + ">›</button>" +
        "</span>";
    }
  }

  function popularSelectCategorias() {
    var nomes = S.cats.map(function (c) { return c.nome; });
    S.lanc.forEach(function (l) { if (l.categoria && nomes.indexOf(l.categoria) === -1) nomes.push(l.categoria); });
    nomes.sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });

    var filtro = $("#filtroCategoria");
    var atualF = S.cat;
    filtro.innerHTML = "<option value=''>Todas as categorias</option>" +
      nomes.map(function (n) { return "<option value='" + esc(n) + "'>" + esc(n) + "</option>"; }).join("");
    filtro.value = atualF;

    var form = $("#formLanc [name=categoria]");
    var atualForm = form.value;
    var base = S.cats.filter(function (c) { return !S.formTipo || c.tipo === "Ambos" || c.tipo === S.formTipo; })
      .map(function (c) { return c.nome; });
    nomes.forEach(function (n) { if (base.indexOf(n) === -1) base.push(n); });
    form.innerHTML = base.map(function (n) { return "<option value='" + esc(n) + "'>" + esc(n) + "</option>"; }).join("");
    if (atualForm && base.indexOf(atualForm) > -1) form.value = atualForm;
  }

  /* v1.2: select de contas (filtro + formulário) */
  function nomesContas() {
    var nomes = S.contas.map(function (c) { return c.nome; });
    S.lanc.forEach(function (l) { if (l.conta && nomes.indexOf(l.conta) === -1) nomes.push(l.conta); });
    return nomes;
  }
  function popularSelectContas() {
    var nomes = nomesContas();
    var filtro = $("#filtroConta");
    var atualF = S.conta;
    filtro.innerHTML = "<option value=''>Todas as contas</option>" +
      nomes.map(function (n) { return "<option value='" + esc(n) + "'>" + esc(n) + "</option>"; }).join("") +
      (S.lanc.some(function (l) { return !l.conta; }) ? "<option value='" + SEMCONTA + "'>Sem conta</option>" : "");
    filtro.value = atualF;

    var form = $("#formLanc [name=conta]");
    var atualForm = form.value;
    form.innerHTML = "<option value=''>Sem conta</option>" +
      nomes.map(function (n) { return "<option value='" + esc(n) + "'>" + esc(n) + "</option>"; }).join("");
    if (atualForm) form.value = atualForm;
  }

  /* ================= MODAL LANÇAMENTO ================= */
  function novoLancamento() {
    S.editId = null;
    S.formTipo = "Despesa";
    $("#modalTitle").textContent = "Novo lançamento";
    $("#btnSalvarLanc").textContent = "Salvar lançamento";
    var f = $("#formLanc");
    f.reset();
    var hoje = new Date();
    var comp = S.comp !== "todo" ? S.comp : ymHoje();
    var p = comp.split("-");
    f.data.value = (hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0")) === comp
      ? new Date().toISOString().slice(0, 10)
      : p[0] + "-" + p[1] + "-01";
    setTipoForm("Despesa");
    popularSelectCategorias();
    popularSelectContas();
    // v1.2: conta padrão = primeira conta cadastrada; recorrência desligada
    var selConta = f.conta;
    if (S.contas.length) selConta.value = S.contas[0].nome;
    f.recorrente.checked = false;
    $("#sugestaoCat").classList.add("is-hidden");
    $("#formLancError").classList.add("is-hidden");
    abrirModal("#modalLanc");
    setTimeout(function () { f.valor.focus(); }, 60);
  }

  function editarLancamento(id) {
    var l = S.lanc.filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    S.editId = id;
    S.formTipo = ehPix(l.tipo) ? "PIX" : (l.tipo || "Despesa");
    $("#modalTitle").textContent = "Editar lançamento";
    $("#btnSalvarLanc").textContent = "Salvar alterações";
    var f = $("#formLanc");
    f.data.value = l.data || "";
    f.valor.value = (Number(l.valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    f.descricao.value = l.descricao || "";
    f.observacoes.value = l.observacoes || "";
    // v1.1: a situação é restaurada DEPOIS de setTipoForm recriar as opções
    // (antes o select era refeito e perdia a situação original do PIX/Despesa).
    setTipoForm(S.formTipo, l.situacao || null);
    popularSelectCategorias();
    popularSelectContas();
    f.categoria.value = l.categoria || "";
    f.conta.value = l.conta || "";
    f.recorrente.checked = l.recorrencia === "mensal";
    $("#sugestaoCat").classList.add("is-hidden");
    $("#formLancError").classList.add("is-hidden");
    abrirModal("#modalLanc");
  }

  function setTipoForm(tipo, situacaoManter) {
    S.formTipo = tipo;
    $$("#segTipo .seg__b").forEach(function (b) { b.classList.toggle("is-active", b.dataset.tipo === tipo); });
    var sit = $("#formLanc [name=situacao]");
    var opcoes = tipo === "Receita" ? ["Recebido", "Pendente", "Cancelado"]
      : (ehPix(tipo) ? ["Recebido", "Pago", "Pendente", "Cancelado"]
        : ["Pago", "Pendente", "Cancelado"]);
    sit.innerHTML = opcoes.map(function (o) { return "<option>" + o + "</option>"; }).join("");
    // mantém a situação atual quando ela existe no novo tipo; senão, usa o padrão
    sit.value = (situacaoManter && opcoes.indexOf(situacaoManter) > -1) ? situacaoManter : opcoes[0];
    var hint = $("#sitHint");
    if (hint) hint.classList.toggle("is-hidden", !ehPix(tipo));
    popularSelectCategorias();
  }

  function salvarLancamento(ev) {
    ev.preventDefault();
    var f = $("#formLanc");
    var erro = $("#formLancError");
    var valor = parseValor(f.valor.value);
    if (!f.data.value) return mostrarErro(erro, "Informe a data do lançamento.");
    if (!f.descricao.value.trim()) return mostrarErro(erro, "Informe uma descrição.");
    if (!valor || valor <= 0) return mostrarErro(erro, "Informe um valor maior que zero.");

    var item = {
      data: f.data.value,
      tipo: S.formTipo,
      categoria: f.categoria.value,
      descricao: f.descricao.value.trim(),
      valor: Math.round(valor * 100) / 100,
      situacao: f.situacao.value,
      observacoes: f.observacoes.value.trim(),
      conta: f.conta.value || "",
      recorrencia: f.recorrente.checked ? "mensal" : "nenhuma"
    };

    var btn = $("#btnSalvarLanc");
    btn.disabled = true; btn.textContent = "Salvando…";

    var prom = S.editId ? Store.updateLancamento(S.editId, item) : Store.addLancamento(item);
    prom.then(function () {
      btn.disabled = false;
      btn.textContent = "Salvar lançamento";
      fecharModal("#modalLanc");
      toast(S.editId ? "Lançamento atualizado" : "Lançamento criado", item.descricao + " · " + brl(item.valor));
      S.editId = null;
      if (S.comp !== "todo" && ymDe(item.data) !== S.comp) { S.comp = ymDe(item.data); $("#selectComp").value = S.comp; }
      S.pag = 1;
      renderTudo();
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = "Salvar lançamento";
      mostrarErro(erro, (e && e.message) || "Não foi possível salvar.");
    });
  }

  function mostrarErro(box, msg) { box.textContent = msg; box.classList.remove("is-hidden"); return false; }

  /* ================= CATEGORIAS ================= */
  function renderCategorias() {
    // v1.1: busca por digitação + filtro por tipo
    var q = (S.catBusca || "").trim().toLowerCase();
    var filtradas = S.cats.filter(function (c) {
      if (S.catTipo && (c.tipo || "Despesa") !== S.catTipo) return false;
      if (q && String(c.nome || "").toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    $("#catCount").textContent = filtradas.length === S.cats.length
      ? S.cats.length + " categorias"
      : filtradas.length + " de " + S.cats.length + " categorias";
    var box = $("#tagsCategorias");
    if (!S.cats.length) { box.innerHTML = "<p class='muted small'>Nenhuma categoria cadastrada.</p>"; return; }
    if (!filtradas.length) { box.innerHTML = "<p class='muted small'>Nenhuma categoria encontrada com este filtro.</p>"; return; }
    box.innerHTML = filtradas.map(function (c) {
      return "<span class='tag-cat'><i style='background:" + esc(c.cor || "#6366f1") + "'></i>" + esc(c.nome) +
        " <em>" + esc(c.tipo) + "</em>" +
        "<button data-delcat='" + esc(c.id) + "' title='Excluir'>✕</button></span>";
    }).join("");
  }

  /* ================= IMPORTAR / EXPORTAR ================= */
  function normalizarItem(bruto) {
    var m = {};
    Object.keys(bruto).forEach(function (k) { m[normalizarChave(k)] = bruto[k]; });

    var data = m["data"] || m["date"] || m["dia"];
    if (data instanceof Date) {
      data = data.getFullYear() + "-" + String(data.getMonth() + 1).padStart(2, "0") + "-" + String(data.getDate()).padStart(2, "0");
    } else {
      data = String(data || "").trim();
      var p = data.split(/[\/\-]/);
      if (p.length === 3) {
        data = p[2].length === 4 ? p[2] + "-" + p[1].padStart(2, "0") + "-" + p[0].padStart(2, "0")
          : (p[0].length === 4 ? p[0] + "-" + p[1].padStart(2, "0") + "-" + p[2].padStart(2, "0") : null);
      } else data = null;
    }
    if (!data) return null;

    var tipo = String(m["tipo"] || m["type"] || "").trim();
    tipo = tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase();
    if (tipo === "Despesas") tipo = "Despesa";
    if (tipo === "Receitas") tipo = "Receita";
    // v1.1: "Transferência" virou "PIX" (as duas grafias antigas são aceitas na importação)
    if (tipo === "Pix") tipo = "PIX";
    if (tipo === "Transferência" || tipo === "Transferencia") tipo = "PIX";
    if (["Receita", "Despesa", "PIX"].indexOf(tipo) === -1) return null;

    var valor = parseValor(m["valorr"] || m["valor"] || m["value"] || m["valorr$"] || 0);
    if (!valor) return null;

    var sit = String(m["situacao"] || m["situação"] || m["status"] || "").trim();
    sit = sit.charAt(0).toUpperCase() + sit.slice(1).toLowerCase();
    if (["Pago", "Recebido", "Pendente", "Cancelado"].indexOf(sit) === -1) {
      // PIX sem situação importada fica "Pendente" (não entra nos totais até ser definida)
      sit = tipo === "Receita" ? "Recebido" : (tipo === "PIX" ? "Pendente" : "Pago");
    }

    return {
      data: data,
      tipo: tipo,
      categoria: String(m["categoria"] || "Outros").trim() || "Outros",
      descricao: String(m["descricao"] || m["descrição"] || m["historico"] || "Sem descrição").trim(),
      valor: valor,
      situacao: sit,
      observacoes: String(m["observacoes"] || m["observações"] || m["obs"] || "").trim()
    };
  }

  function normalizarChave(k) {
    return String(k).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9$]/g, "");
  }

  function lerArquivo(file) {
    var nome = file.name.toLowerCase();
    if (/\.json$/.test(nome)) return file.text().then(function (txt) {
      var j = JSON.parse(txt);
      return Array.isArray(j) ? j : (j.lancamentos || j.data || []);
    });
    if (/\.(xlsx|xls)$/.test(nome)) {
      return garantirSheetJS().then(function () {
        return file.arrayBuffer().then(function (buf) {
          var wb = window.XLSX.read(buf, { type: "array", cellDates: true });
          return melhorAba(wb);
        });
      });
    }
    return file.text().then(parseCSV);
  }

  /* Percorre as abas da planilha e escolhe a que realmente contém
     lançamentos (cabeçalho com Data + Tipo + Valor). A planilha do
     usuário tem várias abas (Painel, Resumo, Listas…), então não dá
     para assumir a primeira. */
  function melhorAba(wb) {
    var melhor = null;
    wb.SheetNames.forEach(function (nome) {
      var ws = wb.Sheets[nome];
      if (!ws) return;
      var linhas;
      try { linhas = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true }); }
      catch (e) { return; }
      for (var i = 0; i < Math.min(12, linhas.length); i++) {
        var cab = (linhas[i] || []).map(normalizarChave);
        var temData = cab.indexOf("data") > -1;
        var temTipo = cab.indexOf("tipo") > -1;
        var temValor = cab.some(function (c) { return c.indexOf("valor") === 0; });
        if (!(temData && temTipo && temValor)) continue;
        var objs = linhas.slice(i + 1)
          .filter(function (l) { return l && l.some(function (c) { return String(c == null ? "" : c).trim() !== ""; }); })
          .map(function (l) {
            var o = {};
            cab.forEach(function (h, idx) { o[h] = l[idx]; });
            return o;
          });
        if (!melhor || objs.length > melhor.length) melhor = objs;
        break;
      }
    });
    return melhor || [];
  }

  function garantirSheetJS() {
    if (window.XLSX) return Promise.resolve();
    return carregarScript("https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js");
  }

  function parseCSV(txt) {
    txt = txt.replace(/^\uFEFF/, "");
    var linhas = [];
    var atual = [], campo = "", aspas = false;
    for (var i = 0; i < txt.length; i++) {
      var c = txt[i];
      if (aspas) {
        if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') aspas = false;
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === ";" || c === "," || c === "\t") { atual.push(campo); campo = ""; }
      else if (c === "\n") { atual.push(campo); linhas.push(atual); atual = []; campo = ""; }
      else if (c !== "\r") campo += c;
    }
    if (campo.length || atual.length) { atual.push(campo); linhas.push(atual); }
    if (!linhas.length) return [];
    var cab = linhas.shift();
    return linhas.filter(function (l) { return l.some(function (x) { return String(x).trim(); }); })
      .map(function (l) {
        var o = {};
        cab.forEach(function (h, i) { o[h] = l[i]; });
        return o;
      });
  }

  function processarArquivo(file) {
    $("#previewTitle").textContent = "Pré-visualização · " + file.name;
    lerArquivo(file).then(function (brutos) {
      var itens = (brutos || []).map(normalizarItem).filter(Boolean);
      if (!itens.length) {
        toast("Nenhum lançamento válido encontrado", "Verifique as colunas: Data, Tipo, Categoria, Descrição, Valor, Situação.", "err");
        return;
      }
      exibirPreview(itens);
    }).catch(function (e) {
      console.error(e);
      toast("Não foi possível ler o arquivo", e.message || "Formato não reconhecido.", "err");
    });
  }

  function exibirPreview(itens) {
    S.importPendente = itens;
    $("#importPreview").classList.remove("is-hidden");
    $("#previewCount").textContent = itens.length + " linhas válidas";
    $("#previewBody").innerHTML = itens.slice(0, 8).map(function (i) {
      return "<tr><td>" + fmtData(i.data) + "</td><td><span class='badge badge--" + esc(i.tipo) + "'>" + esc(i.tipo) + "</span></td>" +
        "<td>" + esc(i.categoria) + "</td><td>" + esc(i.descricao) + "</td><td class='num'>" + esc(brl(i.valor)) + "</td></tr>";
    }).join("") + (itens.length > 8 ? "<tr><td colspan='5' class='muted'>… e mais " + (itens.length - 8) + " lançamentos</td></tr>" : "");
    $("#importPreview").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function confirmarImportacao() {
    if (!S.importPendente) return;
    var itens = S.importPendente.slice();
    if ($("#chkDuplicados").checked) {
      var existentes = {};
      S.lanc.forEach(function (l) { existentes[Store.chave(l)] = 1; });
      itens = itens.filter(function (i) { return !existentes[Store.chave(i)]; });
    }
    if (!itens.length) { toast("Nada a importar", "Todos os lançamentos já existem na sua conta.", "warn"); return; }
    if (itens.length > CFG.limiteImportacao) {
      itens = itens.slice(0, CFG.limiteImportacao);
      toast("Importação limitada a " + CFG.limiteImportacao + " itens por vez", "Importe em etapas menores.", "warn");
    }
    $("#btnConfirmarImport").disabled = true;
    Store.importarLancamentos(itens, false).then(function (n) {
      $("#btnConfirmarImport").disabled = false;
      $("#importPreview").classList.add("is-hidden");
      S.importPendente = null;
      $("#fileInput").value = "";
      toast(n + " lançamento(s) importado(s)", "Já aparecem no painel e na tabela.", "ok");
      renderTudo();
    }).catch(function (e) {
      $("#btnConfirmarImport").disabled = false;
      toast("Falha na importação", e.message || "", "err");
    });
  }

  function baixarArquivo(nome, conteudo, mime) {
    var blob = new Blob([conteudo], { type: mime + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function exportCSV() {
    var list = filtrados();
    var cab = ["Data", "Tipo", "Categoria", "Descrição", "Valor (R$)", "Situação", "Observações"];
    var linhas = list.map(function (l) {
      return [fmtData(l.data), l.tipo, l.categoria, l.descricao,
        String(l.valor).replace(".", ","), l.situacao, l.observacoes]
        .map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(";");
    });
    baixarArquivo("lancamentos-" + ymHoje() + ".csv", "\uFEFF" + [cab.join(";")].concat(linhas).join("\r\n"), "text/csv");
    toast("CSV gerado", list.length + " lançamento(s).", "ok");
  }

  function exportJSON() {
    baixarArquivo("backup-fincontrol-" + ymHoje() + ".json",
      JSON.stringify({ exportadoEm: agora(), usuario: S.user && S.user.email, lancamentos: S.lanc, categorias: S.cats }, null, 2),
      "application/json");
    toast("Backup JSON gerado", S.lanc.length + " lançamento(s).", "ok");
  }

  function exportResumo() {
    var mapa = {};
    ativo(S.lanc.filter(function (l) { return l.data && l.data.slice(0, 4) === String(S.anoRef); })).forEach(function (l) {
      var k = (classificar(l) || tipoBase(l) || "—") + ";" + (l.categoria || "Outros");
      mapa[k] = (mapa[k] || 0) + (Number(l.valor) || 0);
    });
    var linhas = Object.keys(mapa).sort().map(function (k) { return '"' + k.split(";")[0] + '";"' + k.split(";")[1] + '";' + String(mapa[k]).replace(".", ","); });
    baixarArquivo("resumo-anual-" + S.anoRef + ".csv", "\uFEFF" + "Tipo;Categoria;Total anual (R$)\r\n" + linhas.join("\r\n"), "text/csv");
    toast("Resumo anual exportado", "Ano de referência: " + S.anoRef, "ok");
  }

  function agora() { return new Date().toISOString(); }

  function carregarExemplo() {
    exibirPreview(window.EXEMPLO_LANCAMENTOS.map(function (i) {
      return { data: i.data, tipo: i.tipo, categoria: i.categoria, descricao: i.descricao, valor: i.valor, situacao: i.situacao, observacoes: i.observacoes };
    }));
    $("#previewTitle").textContent = "Pré-visualização · dados de exemplo (sintéticos)";
  }

  /* ================= CONFIGURAÇÕES ================= */
  function renderConfig() {
    var f = $("#formPerfil");
    f.nome.value = S.user && S.user.nome ? S.user.nome : "";
    f.email.value = S.user && S.user.email ? S.user.email : "";
    var fb = S.mode === "firebase";
    $("#storagePill").textContent = fb ? "Firebase · nuvem" : "Local · neste navegador";
    $("#storagePill").className = "pill " + (fb ? "pill--green" : "pill--warn");
    $("#storageDesc").textContent = fb
      ? "Seus dados ficam no Cloud Firestore e sincronizam entre dispositivos (plano Spark, gratuito)."
      : "Sem Firebase configurado: os dados ficam salvos apenas neste navegador. Configure o Firebase em js/config.js para sincronizar.";
    var t = totaisDo(S.lanc);
    $("#contaTotais").textContent = S.lanc.length + " lançamento(s) · " + S.cats.length + " categoria(s) · saldo acumulado " + brl(t.saldo);
  }

  /* ================= RENDER GERAL ================= */
  /* Coalesce: os watchers de lançamentos e categorias podem disparar
     praticamente juntos; agrupamos tudo em um único render por quadro
     para não repintar (nem reanimar os gráficos) duas vezes. */
  var _renderPendente = false;
  function renderTudo() {
    if (!S.user) return;
    if (_renderPendente) return;
    _renderPendente = true;
    var passo = function () {
      _renderPendente = false;
      renderInterna();
    };
    if (window.requestAnimationFrame) requestAnimationFrame(passo);
    else setTimeout(passo, 16);
  }

  function renderInterna() {
    var w = $("#welcome");
    if (w) w.classList.toggle("is-hidden", S.lanc.length > 0);
    montarSelectComp(); // v1.1: opções só com meses que têm lançamento
    popularSelectCategorias();
    popularSelectContas(); // v1.2
    montarSelectAno();
    renderPainel();
    renderTabela();
    renderCategorias();
    renderOrcamentosCfg(); // v1.2
    renderContas();        // v1.2
    renderMetas();         // v1.2
    renderConfig();
  }

  var TITULOS = {
    painel: ["Painel", "Visão geral das suas finanças"],
    lancamentos: ["Lançamentos", "Consulte, filtre e edite suas movimentações"],
    categorias: ["Categorias", "Organize suas contas por categoria"],
    contas: ["Contas e carteiras", "Saldo individual e consolidado por conta"],
    metas: ["Metas e caixinhas", "Acompanhe o progresso das suas metas"],
    simuladores: ["Simuladores", "Juros compostos e resgate vs. deixar render"],
    importar: ["Importar / Exportar", "Traga sua planilha ou baixe seus dados"],
    config: ["Configurações", "Conta, aparência e armazenamento"]
  };

  function rotear() {
    var hash = (location.hash || "#/painel").replace("#/", "");
    if (!TITULOS[hash]) hash = "painel";
    $$(".view").forEach(function (v) { v.classList.toggle("is-hidden", v.id !== "view-" + hash); });
    $$(".navitem").forEach(function (a) { a.classList.toggle("is-active", a.dataset.nav === hash); });
    $("#pageTitle").textContent = TITULOS[hash][0];
    $("#pageSubtitle").textContent = TITULOS[hash][1];
    fecharSidebar();
    if (hash === "painel") { window.Charts.destroyAll(); renderPainel(); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ================= AUTH / APP ================= */
  function mostrarAuth() {
    $("#appView").classList.add("is-hidden");
    $("#authView").classList.remove("is-hidden");
    $("#modeBadge").textContent = S.mode === "firebase"
      ? "Protegido por Firebase Authentication · dados na nuvem (plano gratuito)"
      : "Modo local: dados salvos neste navegador. Configure o Firebase em js/config.js para usar nuvem.";
  }

  function entrarApp(user) {
    S.user = user;
    $("#authView").classList.add("is-hidden");
    $("#appView").classList.remove("is-hidden");
    $("#userName").textContent = user.nome || "Usuário";
    $("#userEmail").textContent = user.email || "";
    $("#avatarLetter").textContent = (user.nome || user.email || "U").trim().charAt(0).toUpperCase();

    if (unsubLanc) unsubLanc();
    if (unsubCats) unsubCats();
    if (unsubContas) unsubContas();
    if (unsubMetas) unsubMetas();
    S._recOk = false;
    unsubLanc = Store.watchLanc(function (lista) {
      S.lanc = lista || [];
      renderTudo();
      // v1.2: gera os meses seguintes dos lançamentos recorrentes uma única vez por sessão
      if (!S._recOk) { S._recOk = true; setTimeout(gerarRecorrentes, 900); }
    });
    unsubCats = Store.watchCats(function (lista) { S.cats = lista || []; renderTudo(); });
    unsubContas = Store.watchContas(function (lista) { S.contas = lista || []; renderTudo(); });
    unsubMetas = Store.watchMetas(function (lista) { S.metas = lista || []; renderTudo(); });

    if (!location.hash) location.hash = "#/painel";
    rotear();
    toast("Olá, " + (user.nome || "").split(" ")[0] + "!", "Sessão iniciada com sucesso.", "ok");
  }

  function sair() {
    confirmar("Deseja encerrar a sessão neste dispositivo?", "Sair").then(function (ok) {
      if (!ok) return;
      Store.signOut().then(function () {
        S.user = null;
        S._recOk = false;
        if (unsubLanc) { unsubLanc(); unsubLanc = null; }
        if (unsubCats) { unsubCats(); unsubCats = null; }
        if (unsubContas) { unsubContas(); unsubContas = null; }
        if (unsubMetas) { unsubMetas(); unsubMetas = null; }
        window.Charts.destroyAll();
        location.hash = "";
        mostrarAuth();
        toast("Sessão encerrada", "Até logo!", "ok");
      });
    });
  }

  function irParaAba(tab) {
    $$(".auth__tab").forEach(function (b) { b.classList.toggle("is-active", b.dataset.authtab === tab); });
    $("#formLogin").classList.toggle("is-hidden", tab !== "login");
    $("#formCadastro").classList.toggle("is-hidden", tab !== "cadastro");
    $("#formRecuperar").classList.toggle("is-hidden", tab !== "recuperar");
  }

  function lidarErro(e) {
    var msg = (e && e.code) ? codigos[e.code] || e.message : (e && e.message) || String(e);
    toast("Ops, algo deu errado", msg, "err");
  }

  var codigos = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-not-found": "Não existe conta com este e-mail.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Já existe uma conta com este e-mail.",
    "auth/weak-password": "A senha precisa ter ao menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos.",
    "auth/network-request-failed": "Falha de conexão com o Firebase.",
    "auth/missing-email": "Informe o e-mail."
  };

  /* ================= sidebar ================= */
  function abrirSidebar() { $("#sidebar").classList.add("is-open"); $("#scrim").classList.add("is-open"); }
  function fecharSidebar() { $("#sidebar").classList.remove("is-open"); $("#scrim").classList.remove("is-open"); }

  /* ================= eventos ================= */
  function bind() {
    // abas de autenticação
    $$("[data-authtab]").forEach(function (b) { b.addEventListener("click", function () { irParaAba(b.dataset.authtab); }); });
    $$("[data-goto]").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); irParaAba(a.dataset.goto); });
    });
    $$(".pw-toggle").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = b.previousElementSibling;
        var vis = i.type === "text";
        i.type = vis ? "password" : "text";
        b.textContent = vis ? "Mostrar" : "Ocultar";
      });
    });

    $("#formLogin").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, btn = f.querySelector("[type=submit]");
      btn.disabled = true; btn.textContent = "Entrando…";
      Store.signIn(f.email.value.trim().toLowerCase(), f.senha.value)
        .then(function (u) { entrarApp(u); })
        .catch(lidarErro)
        .then(function () { btn.disabled = false; btn.textContent = "Entrar"; });
    });

    $("#formCadastro").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, btn = f.querySelector("[type=submit]");
      if (!f.termos.checked) return toast("Aceite os termos para continuar", "", "warn");
      if (f.senha.value.length < 6) return toast("Senha muito fraca", "Use ao menos 6 caracteres.", "warn");
      btn.disabled = true; btn.textContent = "Criando…";
      Store.signUp({ nome: f.nome.value.trim(), email: f.email.value.trim().toLowerCase(), senha: f.senha.value })
        .then(function (u) { toast("Conta criada!", "Bem-vindo ao FinControl.", "ok"); entrarApp(u); })
        .catch(lidarErro)
        .then(function () { btn.disabled = false; btn.textContent = "Criar conta"; });
    });

    $("#formRecuperar").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, btn = f.querySelector("[type=submit]");
      btn.disabled = true; btn.textContent = "Enviando…";
      Store.sendPasswordReset(f.email.value.trim().toLowerCase())
        .then(function (r) {
          if (r && r.local) toast("Modo local", "Sem servidor de e-mail: crie uma nova conta ou configure o Firebase para redefinir a senha.", "warn");
          else toast("Link enviado!", "Confira a caixa de entrada e o spam.", "ok");
          irParaAba("login");
        })
        .catch(lidarErro)
        .then(function () { btn.disabled = false; btn.textContent = "Enviar link"; });
    });

    // navegação
    window.addEventListener("hashchange", function () { if (S.user) rotear(); });
    $("#btnOpenSidebar").addEventListener("click", abrirSidebar);
    $("#btnCloseSidebar").addEventListener("click", fecharSidebar);
    $("#scrim").addEventListener("click", fecharSidebar);
    $("#btnSair").addEventListener("click", sair);
    $("#btnSair2").addEventListener("click", sair);

    // tema
    $("#btnTheme").addEventListener("click", function () { aplicarTema(temaAtual() === "dark" ? "light" : "dark"); });
    $$("#segTema .seg__b").forEach(function (b) {
      b.addEventListener("click", function () { aplicarTema(b.dataset.themeSet); });
    });

    // competência / ano
    $("#selectComp").addEventListener("change", function () {
      S.comp = this.value; S.pag = 1;
      window.Charts.destroyAll();
      renderPainel(); renderTabela();
    });
    $("#selectAno").addEventListener("change", function () { S.anoRef = Number(this.value); renderResumoAnual(); renderConfig(); });

    // filtros
    var tBusca;
    $("#filtroBusca").addEventListener("input", function () {
      clearTimeout(tBusca);
      var v = this.value;
      tBusca = setTimeout(function () { S.busca = v; S.pag = 1; renderTabela(); }, 220);
    });
    $("#filtroTipo").addEventListener("change", function () { S.tipo = this.value; S.pag = 1; renderTabela(); });
    $("#filtroCategoria").addEventListener("change", function () { S.cat = this.value; S.pag = 1; renderTabela(); });
    $("#filtroConta").addEventListener("change", function () { S.conta = this.value; S.pag = 1; renderTabela(); });
    $("#filtroSituacao").addEventListener("change", function () { S.sit = this.value; S.pag = 1; renderTabela(); });
    // v1.1: filtros de período e ordenação
    $("#filtroDe").addEventListener("change", function () { S.de = this.value; S.pag = 1; renderTabela(); });
    $("#filtroAte").addEventListener("change", function () { S.ate = this.value; S.pag = 1; renderTabela(); });
    $("#filtroOrdem").addEventListener("change", function () { S.ordem = this.value; S.pag = 1; renderTabela(); });
    $("#btnLimparFiltros").addEventListener("click", function () {
      S.busca = ""; S.tipo = ""; S.cat = ""; S.sit = ""; S.pag = 1;
      S.de = ""; S.ate = ""; S.ordem = "data-desc"; S.conta = "";
      $("#filtroBusca").value = ""; $("#filtroTipo").value = ""; $("#filtroCategoria").value = ""; $("#filtroSituacao").value = "";
      $("#filtroConta").value = "";
      $("#filtroDe").value = ""; $("#filtroAte").value = ""; $("#filtroOrdem").value = "data-desc";
      renderTabela();
    });

    // v1.1: busca e filtro de categorias
    var tCat;
    $("#buscaCat").addEventListener("input", function () {
      clearTimeout(tCat);
      var v = this.value;
      tCat = setTimeout(function () { S.catBusca = v; renderCategorias(); }, 200);
    });
    $("#filtroCatTipo").addEventListener("change", function () { S.catTipo = this.value; renderCategorias(); });
    $("#btnLimparCat").addEventListener("click", function () {
      S.catBusca = ""; S.catTipo = "";
      $("#buscaCat").value = ""; $("#filtroCatTipo").value = "";
      renderCategorias();
    });

    // novo lançamento
    $("#btnNovoTopo").addEventListener("click", novoLancamento);
    document.addEventListener("click", function (e) {
      var novo = e.target.closest("[data-novo]");
      if (novo) { novoLancamento(); return; }

      var ex = e.target.closest("[data-exemplo]");
      if (ex) {
        location.hash = "#/importar";
        setTimeout(carregarExemplo, 260);
        return;
      }

      var ed = e.target.closest("[data-edit]");
      if (ed) { editarLancamento(ed.dataset.edit); return; }

      var del = e.target.closest("[data-del]");
      if (del) {
        var id = del.dataset.del;
        var l = S.lanc.filter(function (x) { return x.id === id; })[0];
        confirmar("Excluir “" + ((l && l.descricao) || "este lançamento") + "” permanentemente?", "Excluir lançamento")
          .then(function (ok) {
            if (!ok) return;
            Store.deleteLancamento(id).then(function () { toast("Lançamento excluído", "", "ok"); renderTudo(); }).catch(lidarErro);
          });
        return;
      }

      var pg = e.target.closest("[data-pag]");
      if (pg && !pg.disabled) { S.pag = Number(pg.dataset.pag); renderTabela(); $("#view-lancamentos").scrollIntoView({ behavior: "smooth", block: "start" }); return; }

      var dc = e.target.closest("[data-delcat]");
      if (dc) {
        var cid = dc.dataset.delcat;
        var cat = S.cats.filter(function (c) { return c.id === cid; })[0];
        confirmar("Remover a categoria “" + (cat && cat.nome) + "”?", "Excluir categoria").then(function (ok) {
          if (!ok) return;
          Store.deleteCategoria(cid).then(function () { toast("Categoria removida", "", "ok"); renderTudo(); }).catch(lidarErro);
        });
        return;
      }

      // ---- v1.2: ações de metas e contas ----
      var ap = e.target.closest("[data-aportar]");
      if (ap) { abrirAporteModal(S.metas.filter(function (m) { return m.id === ap.dataset.aportar; })[0]); return; }

      var em = e.target.closest("[data-editmeta]");
      if (em) { abrirMetaModal(S.metas.filter(function (m) { return m.id === em.dataset.editmeta; })[0]); return; }

      var dm = e.target.closest("[data-delmeta]");
      if (dm) {
        var mid = dm.dataset.delmeta;
        var meta = S.metas.filter(function (m) { return m.id === mid; })[0];
        confirmar("Excluir a meta “" + (meta && meta.nome) + "” e os aportes registrados nela?", "Excluir meta").then(function (ok) {
          if (!ok) return;
          Store.deleteMeta(mid).then(function () { toast("Meta excluída", "", "ok"); }).catch(lidarErro);
        });
        return;
      }

      var ec = e.target.closest("[data-editconta]");
      if (ec) {
        var conta = S.contas.filter(function (c) { return c.id === ec.dataset.editconta; })[0];
        if (!conta) return;
        S.contaEditId = conta.id;
        var fc = $("#formConta");
        fc.nome.value = conta.nome || "";
        fc.banco.value = conta.banco || "";
        fc.tipo.value = conta.tipo || "Conta corrente";
        fc.saldoInicial.value = (Number(conta.saldoInicial) || 0)
          ? Number(conta.saldoInicial).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "";
        fc.cor.value = conta.cor || "#6366f1";
        $("#contaFormTitle").textContent = "Editar conta";
        $("#btnSalvarConta").textContent = "Salvar alterações";
        $("#formContaError").classList.add("is-hidden");
        fc.nome.focus();
        return;
      }

      var dc2 = e.target.closest("[data-delconta]");
      if (dc2) {
        var cid2 = dc2.dataset.delconta;
        var conta2 = S.contas.filter(function (c) { return c.id === cid2; })[0];
        confirmar("Excluir a conta “" + (conta2 && conta2.nome) + "”? Os lançamentos dela passam a ficar “sem conta”.", "Excluir conta").then(function (ok) {
          if (!ok) return;
          Store.deleteConta(cid2).then(function () { toast("Conta excluída", "", "ok"); limparFormConta(); }).catch(lidarErro);
        });
        return;
      }

      var nm2 = e.target.closest("#btnNovaMeta2");
      if (nm2) { abrirMetaModal(null); return; }

      var fechar = e.target.closest("[data-close]");
      if (fechar) {
        var modal = fechar.closest(".modal");
        if (modal) fecharModal("#" + modal.id);
      }
    });

    // modal (v1.1: ao trocar o tipo, preserva a situação atual quando válida)
    $$("#segTipo .seg__b").forEach(function (b) {
      b.addEventListener("click", function () {
        var sit = $("#formLanc [name=situacao]");
        setTipoForm(b.dataset.tipo, sit ? sit.value : null);
      });
    });
    $("#formLanc").addEventListener("submit", salvarLancamento);
    // v1.2: sugestão automática de categoria enquanto digita a descrição
    $("#formLanc [name=descricao]").addEventListener("input", agendarSugestao);
    $("#sugestaoCat").addEventListener("click", function (e) {
      var b = e.target.closest("[data-sug]");
      if (!b) return;
      $("#formLanc [name=categoria]").value = b.dataset.sug;
      atualizarSugestao();
    });
    $$(".modal").forEach(function (m) {
      m.addEventListener("mousedown", function (e) { if (e.target === m) fecharModal("#" + m.id); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { $$(".modal.is-open").forEach(function (m) { fecharModal("#" + m.id); }); fecharSidebar(); }
    });
    $("#btnConfirmOk").addEventListener("click", function () {
      var cb = confirmCb; confirmCb = null;
      $("#modalConfirm").classList.remove("is-open");
      if (cb) cb(true);
    });

    // categorias
    $("#formCategoria").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      var nome = f.nome.value.trim();
      if (!nome) return;
      if (S.cats.some(function (c) { return c.nome.toLowerCase() === nome.toLowerCase(); })) {
        return toast("Categoria já existe", nome, "warn");
      }
      Store.addCategoria({ nome: nome, tipo: f.tipo.value, cor: f.cor.value })
        .then(function () { toast("Categoria adicionada", nome, "ok"); f.reset(); f.cor.value = "#6366f1"; renderTudo(); })
        .catch(lidarErro);
    });

    // ---- v1.2: contas e carteiras ----
    $("#btnNovaConta").addEventListener("click", limparFormConta);
    $("#formConta").addEventListener("submit", salvarConta);

    // ---- v1.2: metas / caixinhas ----
    $("#btnNovaMeta").addEventListener("click", function () { abrirMetaModal(null); });
    $("#formMeta").addEventListener("submit", salvarMeta);
    $("#formAporte").addEventListener("submit", salvarAporte);

    // ---- v1.2: orçamento por categoria (salva ao sair do campo) ----
    $("#orcamentosCfg").addEventListener("change", function (e) {
      var inp = e.target.closest("[data-orc]");
      if (!inp) return;
      var cat = S.cats.filter(function (c) { return c.id === inp.dataset.orc; })[0];
      if (!cat) return;
      var v = Math.max(0, parseValor(inp.value));
      Store.updateCategoria(cat.id, { orcamento: Math.round(v * 100) / 100 }).then(function () {
        toast(v > 0 ? "Orçamento definido" : "Orçamento removido", cat.nome + (v > 0 ? " · " + brl(v) + "/mês" : ""), "ok");
        renderTudo();
      }).catch(lidarErro);
    });

    // ---- v1.2: simuladores ----
    $("#formJuros").addEventListener("submit", simularJuros);
    $("#formResgate").addEventListener("submit", simularResgate);

    // importar
    var drop = $("#dropZone"), fileInput = $("#fileInput");
    $("#btnEscolherArquivo").addEventListener("click", function () { fileInput.click(); });
    drop.addEventListener("click", function (e) { if (e.target === drop || e.target.closest(".drop__ico") || e.target.tagName === "P" || e.target.tagName === "STRONG") fileInput.click(); });
    fileInput.addEventListener("change", function () { if (this.files[0]) processarArquivo(this.files[0]); });
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-over"); });
    });
    drop.addEventListener("drop", function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) processarArquivo(f);
    });
    $("#btnConfirmarImport").addEventListener("click", confirmarImportacao);
    $("#btnCarregarExemplo").addEventListener("click", function (e) { e.stopPropagation(); carregarExemplo(); });

    // exportar
    $("#btnExportCsv").addEventListener("click", exportCSV);
    $("#btnExportJson").addEventListener("click", exportJSON);
    $("#btnExportResumo").addEventListener("click", exportResumo);
    $("#btnExportResumo2").addEventListener("click", exportResumo);

    // configurações
    $("#formPerfil").addEventListener("submit", function (e) {
      e.preventDefault();
      var nome = e.target.nome.value.trim();
      if (!nome) return;
      Store.updateProfile(nome).then(function () {
        $("#userName").textContent = nome;
        $("#avatarLetter").textContent = nome.charAt(0).toUpperCase();
        toast("Perfil atualizado", nome, "ok");
      }).catch(lidarErro);
    });
    $("#btnApagar").addEventListener("click", function () {
      confirmar("Todos os seus lançamentos serão apagados permanentemente. Esta ação não pode ser desfeita.", "Apagar todos os dados")
        .then(function (ok) {
          if (!ok) return;
          Store.apagarTudo().then(function () { toast("Dados apagados", "Sua conta está vazia agora.", "ok"); renderTudo(); }).catch(lidarErro);
        });
    });

    // redimensionamento (canva sem Chart.js)
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (!window.Chart && S.user) redesenharGraficos(); }, 250);
    });
  }

  /* ================= boot ================= */
  function boot() {
    var tema = localStorage.getItem("fincontrol.tema") ||
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", tema);

    montarSelectComp();
    bind();
    registrarPWA();

    // bibliotecas opcionais (CDN) — se falharem, o site continua funcionando
    carregarScript("https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js")
      .then(function () { redesenharGraficos(); })
      .catch(function () { console.info("Chart.js indisponível — usando gráficos nativos."); });

    Store.init().then(function (st) {
      S.mode = st.mode;
      $("#modeBadge").textContent = st.firebase
        ? "Protegido por Firebase Authentication · dados na nuvem (plano gratuito)"
        : "Modo local: dados salvos neste navegador. Configure o Firebase em js/config.js para usar nuvem.";
      return new Promise(function (res) {
        unsubAuth = Store.onAuth(function (u) { res(u); });
      });
    }).then(function (u) {
      if (u) entrarApp(u); else mostrarAuth();
    }).catch(function (e) {
      console.error(e);
      mostrarAuth();
      toast("Falha ao iniciar", e.message || "", "err");
    });
  }

  /* ================= PWA (v1.1) =================
     Registra o service worker que deixa o app instalável (Android/Windows/iOS)
     e disponível offline. Só funciona em contexto seguro (HTTPS ou localhost). */
  function registrarPWA() {
    if (!("serviceWorker" in navigator)) return;
    var seguro = location.protocol === "https:" ||
      location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (!seguro) return;
    navigator.serviceWorker.register("sw.js").catch(function () {
      /* sem service worker o site continua funcionando normalmente */
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
