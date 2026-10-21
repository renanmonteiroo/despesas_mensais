/* =========================================================
   FinControl · gráficos (charts.js)
   Usa Chart.js quando disponível; caso contrário desenha
   gráficos nativos em canvas (funciona 100% offline).
   ========================================================= */
window.Charts = (function () {
  "use strict";

  var CORES = {
    green: "#059669", red: "#e11d48", blue: "#2563eb"
  };
  // cores que acompanham o tema atual (lidas do CSS)
  function corEixo() { return css("--muted", "#7b879b"); }
  function corGrade() { return css("--border-strong", "#d6dcea"); }
  var PALETA = ["#6366f1", "#e11d48", "#059669", "#f59e0b", "#0891b2", "#7c3aed",
                "#db2777", "#65a30d", "#0ea5e9", "#f97316", "#14b8a6", "#a855f7"];

  var fluxoInst = null, catInst = null;

  function css(varName, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(varName);
    return (v && v.trim()) || fallback;
  }

  /* ---------------- FLUXO MENSAL ---------------- */
  function fluxo(el, dados) {
    if (!el) return;
    destroyFluxo();
    var labels = dados.map(function (d) { return d.label; });
    var rec = dados.map(function (d) { return d.receitas; });
    var des = dados.map(function (d) { return d.despesas; });
    var sal = dados.map(function (d) { return d.saldo; });

    if (window.Chart) {
      fluxoInst = new Chart(el.getContext("2d"), {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            { label: "Receitas", data: rec, backgroundColor: "rgba(5,150,105,.85)", borderRadius: 6, barPercentage: .7, categoryPercentage: .68, order: 2 },
            { label: "Despesas", data: des, backgroundColor: "rgba(225,29,72,.8)", borderRadius: 6, barPercentage: .7, categoryPercentage: .68, order: 2 },
            { label: "Saldo", data: sal, type: "line", borderColor: CORES.blue, backgroundColor: "rgba(37,99,235,.12)",
              borderWidth: 2.5, tension: .38, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: CORES.blue,
              fill: true, order: 1 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#0f172a", padding: 11, cornerRadius: 9, titleFont: { weight: "700" },
              callbacks: { label: function (c) { return " " + c.dataset.label + ": " + brl(c.parsed.y); } }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: corEixo(), font: { size: 11, weight: "600" } }, border: { display: false } },
            y: {
              grid: { color: corGrade() }, border: { display: false },
              ticks: { color: corEixo(), font: { size: 11 }, callback: function (v) { return milhar(v); } }
            }
          }
        }
      });
    } else {
      desenharFluxoFallback(el, labels, rec, des, sal);
    }
  }

  /* ---------------- DONUT DE CATEGORIAS ---------------- */
  function donut(el, dados) {
    if (!el) return;
    destroyCat();
    if (window.Chart) {
      catInst = new Chart(el.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: dados.map(function (d) { return d.nome; }),
          datasets: [{
            data: dados.map(function (d) { return d.valor; }),
            backgroundColor: dados.map(function (d, i) { return d.cor || PALETA[i % PALETA.length]; }),
            borderColor: css("--surface", "#fff"), borderWidth: 3, hoverOffset: 8
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: "66%",
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#0f172a", padding: 11, cornerRadius: 9,
              callbacks: { label: function (c) { return " " + c.label + ": " + brl(c.parsed); } }
            }
          }
        }
      });
    } else {
      desenharDonutFallback(el, dados);
    }
  }

  /* ---------------- fallbacks em canvas puro ---------------- */
  function setupCanvas(el) {
    var dpr = window.devicePixelRatio || 1;
    var w = el.clientWidth || el.parentElement.clientWidth || 320;
    var h = el.clientHeight || 260;
    el.width = w * dpr; el.height = h * dpr;
    var ctx = el.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  function desenharFluxoFallback(el, labels, rec, des, sal) {
    var s = setupCanvas(el), ctx = s.ctx, w = s.w, h = s.h;
    var padL = 54, padR = 10, padT = 14, padB = 26;
    var iw = w - padL - padR, ih = h - padT - padB;
    var max = Math.max.apply(null, rec.concat(des).concat(sal).concat([1]));
    max = Math.ceil(max / 1000) * 1000 || 1000;

    // grade
    ctx.font = "11px 'Plus Jakarta Sans', sans-serif";
    ctx.textBaseline = "middle";
    for (var g = 0; g <= 4; g++) {
      var y = padT + ih - (ih * g / 4);
      ctx.strokeStyle = corGrade(); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = corEixo(); ctx.textAlign = "right";
      ctx.fillText(milhar(max * g / 4), padL - 8, y);
    }

    var slot = iw / labels.length;
    var barW = Math.max(4, Math.min(16, slot * .3));

    function yy(v) { return padT + ih - (v / max) * ih; }

    labels.forEach(function (lb, i) {
      var cx = padL + slot * i + slot / 2;
      // receitas
      ctx.fillStyle = "rgba(5,150,105,.85)";
      roundRect(ctx, cx - barW - 1.5, yy(rec[i]), barW, padT + ih - yy(rec[i]), 3); ctx.fill();
      // despesas
      ctx.fillStyle = "rgba(225,29,72,.8)";
      roundRect(ctx, cx + 1.5, yy(des[i]), barW, padT + ih - yy(des[i]), 3); ctx.fill();
      // rótulo do mês
      ctx.fillStyle = corEixo(); ctx.textAlign = "center";
      ctx.fillText(lb, cx, h - padB / 2 - 2);
    });

    // linha do saldo
    ctx.strokeStyle = CORES.blue; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
    ctx.beginPath();
    labels.forEach(function (_, i) {
      var cx = padL + slot * i + slot / 2;
      var y = yy(sal[i]);
      if (i === 0) ctx.moveTo(cx, y); else ctx.lineTo(cx, y);
    });
    ctx.stroke();
    labels.forEach(function (_, i) {
      var cx = padL + slot * i + slot / 2, y = yy(sal[i]);
      ctx.fillStyle = CORES.blue;
      ctx.beginPath(); ctx.arc(cx, y, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = css("--surface", "#fff");
      ctx.beginPath(); ctx.arc(cx, y, 1.4, 0, Math.PI * 2); ctx.fill();
    });
  }

  function desenharDonutFallback(el, dados) {
    var s = setupCanvas(el), ctx = s.ctx, w = s.w, h = s.h;
    if (!dados.length) return;
    var total = dados.reduce(function (a, d) { return a + d.valor; }, 0) || 1;
    var cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 16, thick = Math.max(22, r * .38);
    var ang = -Math.PI / 2;

    dados.forEach(function (d, i) {
      var slice = (d.valor / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, ang, ang + slice);
      ctx.arc(cx, cy, r - thick, ang + slice, ang, true);
      ctx.closePath();
      ctx.fillStyle = d.cor || PALETA[i % PALETA.length];
      ctx.fill();
      ang += slice;
    });

    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = corEixo(); ctx.font = "600 11px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("TOTAL", cx, cy - 12);
    ctx.fillStyle = css("--text", "#0f172a"); ctx.font = "800 17px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(brl(total), cx, cy + 8);
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (h < 0) { y = y + h; h = -h; }
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function destroyFluxo() { if (fluxoInst) { fluxoInst.destroy(); fluxoInst = null; } }
  function destroyCat() { if (catInst) { catInst.destroy(); catInst = null; } }

  /* ---------------- helpers ---------------- */
  function brl(v) {
    return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  function milhar(v) {
    v = Math.round(v);
    if (Math.abs(v) >= 1000) return (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k";
    return String(v);
  }

  function destroyAll() { destroyFluxo(); destroyCat(); }

  return { fluxo: fluxo, donut: donut, destroyAll: destroyAll, brl: brl, PALETA: PALETA };
})();
