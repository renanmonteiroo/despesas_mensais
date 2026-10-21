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
    lanc: [], cats: [],
    comp: ymHoje(), busca: "", tipo: "", cat: "", sit: "",
    pag: 1, anoRef: ANOS.corrente,
    editId: null, formTipo: "Despesa",
    importPendente: null, stopLanc: null, stopCats: null
  };

  var unsubAuth = null, unsubLanc = null, unsubCats = null, confirmCb = null;

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

  /* ================= competência (seletor do topo) ================= */
  function montarSelectComp() {
    var sel = $("#selectComp");
    var opcoes = [], d = new Date();
    for (var i = 0; i < 24; i++) {
      var dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
      var ym = dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0");
      opcoes.push({ v: ym, t: MES_CURTO[dt.getMonth()] + " " + dt.getFullYear() });
    }
    sel.innerHTML = '<option value="todo">Todo o período</option>' +
      opcoes.map(function (o) { return '<option value="' + o.v + '">' + o.t + "</option>"; }).join("");
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
      if (l.tipo === "Receita") r += Number(l.valor) || 0;
      else if (l.tipo === "Despesa") d += Number(l.valor) || 0;
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
    kpis.appendChild(kpi({
      classe: "kpi--amber", icone: "%", label: "Taxa de poupança", valor: null, texto: (t.taxa * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%",
      rodape: "<span class='muted'>do que entrou foi guardado</span>"
    }));

    // rodapé extra: ano + pendências
    var tAno = totaisDo(S.lanc.filter(function (l) { return l.data && l.data.slice(0, 4) === String(S.anoRef); }));
    var resumo = el("div", "chips");
    resumo.innerHTML =
      chip("Ano " + S.anoRef + " · receitas", brl(tAno.receitas)) +
      chip("Ano " + S.anoRef + " · despesas", brl(tAno.despesas)) +
      chip("Ano " + S.anoRef + " · saldo", brl(tAno.saldo), tAno.saldo < 0 ? "neg" : "pos") +
      chip("Pendências (" + pend.length + ")", brl(pendValor));
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

    renderResumoAnual();
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
        if (l.tipo === "Receita") r += Number(l.valor) || 0;
        else if (l.tipo === "Despesa") des += Number(l.valor) || 0;
      });
      out.push({ label: MES_CURTO[d.getMonth()] + "/" + String(d.getFullYear()).slice(2), receitas: r, despesas: des, saldo: r - des });
    }
    return out;
  }

  function despesasPorCategoria(list) {
    var mapa = {}, cores = {};
    S.cats.forEach(function (c) { cores[c.nome] = c.cor; });
    ativo(list).forEach(function (l) {
      if (l.tipo !== "Despesa") return;
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
      var rec = l.tipo === "Receita";
      var ico = rec ? "💰" : (l.tipo === "Transferência" ? "🔁" : "🧾");
      var valor = (rec ? "+" : "−") + brl(Math.abs(Number(l.valor) || 0));
      return "<div class='rowl'>" +
        "<span class='rowl__ico'>" + ico + "</span>" +
        "<span class='rowl__txt'><strong>" + esc(l.descricao || l.categoria || "Sem descrição") + "</strong>" +
        "<small>" + esc((l.categoria || "—") + " · " + fmtData(l.data)) + "</small></span>" +
        "<span class='rowl__val " + (rec ? "pos" : "neg") + "'>" + valor + "</span>" +
        (comAcoes ? "<span class='rowl__act'><button class='mini' data-edit='" + esc(l.id) + "' title='Editar'>✎</button></span>" : "") +
        "</div>";
    }).join("");
  }

  function renderResumoAnual() {
    $("#resumoSub").textContent = "Totais do ano de " + S.anoRef + " (lançamentos não cancelados)";
    var mapa = {}, cores = {};
    S.cats.forEach(function (c) { cores[c.nome] = c.cor; });
    ativo(S.lanc.filter(function (l) { return l.data && l.data.slice(0, 4) === String(S.anoRef); })).forEach(function (l) {
      var k = (l.tipo || "—") + "||" + (l.categoria || "Outros");
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
      var cor = l.tipo === "Receita" ? "var(--green)" : (l.tipo === "Transferência" ? "var(--blue)" : "var(--red)");
      return "<tr>" +
        "<td><span class='catlist__name'><i style='background:" + esc(cores[l.categoria] || cor) + "'></i><span>" + esc(l.categoria) + "</span></span></td>" +
        "<td><span class='badge badge--" + esc(l.tipo) + "'>" + esc(l.tipo) + "</span></td>" +
        "<td class='num'>" + esc(brl(l.total)) + "</td>" +
        "<td><span class='barcell'><b style='width:" + pct.toFixed(1) + "%;background:" + cor + "'></b></span>" +
        "<span class='small muted'> " + pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "% das " + esc(l.tipo.toLowerCase()) + "s</span></td>" +
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
    return list.filter(function (l) {
      if (S.tipo && l.tipo !== S.tipo) return false;
      if (S.cat && l.categoria !== S.cat) return false;
      if (S.sit && l.situacao !== S.sit) return false;
      if (q) {
        var alvo = [l.descricao, l.categoria, l.observacoes, l.situacao, l.tipo].join(" ").toLowerCase();
        if (alvo.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function (a, b) {
      var d = (b.data || "").localeCompare(a.data || "");
      if (d !== 0) return d;
      return (b.criadoEm || "").localeCompare(a.criadoEm || "");
    });
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
      if (l.tipo === "Receita") receitas += Number(l.valor) || 0;
      else if (l.tipo === "Despesa") despesas += Number(l.valor) || 0;
      if (l.situacao === "Pendente") pend++;
    });
    $("#resumoChips").innerHTML =
      chip("Receitas", brl(receitas)) +
      chip("Despesas", brl(despesas)) +
      chip("Saldo", brl(receitas - despesas), receitas - despesas < 0 ? "neg" : "pos") +
      chip("Pendentes", String(pend));

    var tbody = $("#tabelaLanc tbody");
    tbody.innerHTML = pagina.map(function (l) {
      var sinal = l.tipo === "Receita" ? "+" : (l.tipo === "Despesa" ? "−" : "");
      var cls = l.tipo === "Receita" ? "pos" : (l.tipo === "Despesa" ? "neg" : "");
      return "<tr>" +
        "<td class='data-cell'>" + fmtData(l.data) + "</td>" +
        "<td><span class='badge badge--" + esc(l.tipo) + "'>" + esc(l.tipo) + "</span></td>" +
        "<td>" + esc(l.categoria || "—") + "</td>" +
        "<td class='desc-cell'><strong>" + esc(l.descricao || "—") + "</strong>" +
          (l.observacoes ? "<small>" + esc(l.observacoes) + "</small>" : "") + "</td>" +
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
    f.situacao.value = "Despesa" === "Receita" ? "Recebido" : "Pago";
    setTipoForm("Despesa");
    popularSelectCategorias();
    $("#formLancError").classList.add("is-hidden");
    abrirModal("#modalLanc");
    setTimeout(function () { f.valor.focus(); }, 60);
  }

  function editarLancamento(id) {
    var l = S.lanc.filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    S.editId = id;
    S.formTipo = l.tipo || "Despesa";
    $("#modalTitle").textContent = "Editar lançamento";
    $("#btnSalvarLanc").textContent = "Salvar alterações";
    var f = $("#formLanc");
    f.data.value = l.data || "";
    f.valor.value = (Number(l.valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    f.descricao.value = l.descricao || "";
    f.observacoes.value = l.observacoes || "";
    f.situacao.value = l.situacao || "Pendente";
    setTipoForm(S.formTipo);
    popularSelectCategorias();
    f.categoria.value = l.categoria || "";
    $("#formLancError").classList.add("is-hidden");
    abrirModal("#modalLanc");
  }

  function setTipoForm(tipo) {
    S.formTipo = tipo;
    $$("#segTipo .seg__b").forEach(function (b) { b.classList.toggle("is-active", b.dataset.tipo === tipo); });
    var sit = $("#formLanc [name=situacao]");
    var opcoes = tipo === "Receita" ? ["Recebido", "Pendente", "Cancelado"] : (tipo === "Transferência" ? ["Recebido", "Pago", "Pendente", "Cancelado"] : ["Pago", "Pendente", "Cancelado"]);
    sit.innerHTML = opcoes.map(function (o) { return "<option>" + o + "</option>"; }).join("");
    if (tipo === "Receita") sit.value = "Recebido";
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
      observacoes: f.observacoes.value.trim()
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
    $("#catCount").textContent = S.cats.length + " categorias";
    var box = $("#tagsCategorias");
    if (!S.cats.length) { box.innerHTML = "<p class='muted small'>Nenhuma categoria cadastrada.</p>"; return; }
    box.innerHTML = S.cats.map(function (c) {
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
    if (["Receita", "Despesa", "Transferência", "Transferencia"].indexOf(tipo) === -1) return null;
    if (tipo === "Transferencia") tipo = "Transferência";

    var valor = parseValor(m["valorr"] || m["valor"] || m["value"] || m["valorr$"] || 0);
    if (!valor) return null;

    var sit = String(m["situacao"] || m["situação"] || m["status"] || "").trim();
    sit = sit.charAt(0).toUpperCase() + sit.slice(1).toLowerCase();
    if (["Pago", "Recebido", "Pendente", "Cancelado"].indexOf(sit) === -1) sit = tipo === "Receita" ? "Recebido" : "Pago";

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
      var k = l.tipo + ";" + (l.categoria || "Outros");
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
    popularSelectCategorias();
    montarSelectAno();
    renderPainel();
    renderTabela();
    renderCategorias();
    renderConfig();
  }

  var TITULOS = {
    painel: ["Painel", "Visão geral das suas finanças"],
    lancamentos: ["Lançamentos", "Consulte, filtre e edite suas movimentações"],
    categorias: ["Categorias", "Organize suas contas por categoria"],
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
    unsubLanc = Store.watchLanc(function (lista) { S.lanc = lista || []; renderTudo(); });
    unsubCats = Store.watchCats(function (lista) { S.cats = lista || []; renderTudo(); });

    if (!location.hash) location.hash = "#/painel";
    rotear();
    toast("Olá, " + (user.nome || "").split(" ")[0] + "!", "Sessão iniciada com sucesso.", "ok");
  }

  function sair() {
    confirmar("Deseja encerrar a sessão neste dispositivo?", "Sair").then(function (ok) {
      if (!ok) return;
      Store.signOut().then(function () {
        S.user = null;
        if (unsubLanc) { unsubLanc(); unsubLanc = null; }
        if (unsubCats) { unsubCats(); unsubCats = null; }
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
    $("#filtroSituacao").addEventListener("change", function () { S.sit = this.value; S.pag = 1; renderTabela(); });
    $("#btnLimparFiltros").addEventListener("click", function () {
      S.busca = ""; S.tipo = ""; S.cat = ""; S.sit = ""; S.pag = 1;
      $("#filtroBusca").value = ""; $("#filtroTipo").value = ""; $("#filtroCategoria").value = ""; $("#filtroSituacao").value = "";
      renderTabela();
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

      var fechar = e.target.closest("[data-close]");
      if (fechar) {
        var modal = fechar.closest(".modal");
        if (modal) fecharModal("#" + modal.id);
      }
    });

    // modal
    $$("#segTipo .seg__b").forEach(function (b) { b.addEventListener("click", function () { setTipoForm(b.dataset.tipo); }); });
    $("#formLanc").addEventListener("submit", salvarLancamento);
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
