/* =========================================================
   FinControl · dados de exemplo (sintéticos)
   Usados apenas pelo botão "Carregar dados de exemplo".
   Não contém dados reais da sua planilha.
   ========================================================= */
window.EXEMPLO_LANCAMENTOS = (function () {
  var categoriasDesp = ["Cartão de crédito", "Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer", "Telefone", "Internet"];
  var descricoes = {
    "Cartão de crédito": ["Fatura Nubank", "Fatura Itaú", "Parcela do notebook"],
    "Moradia": ["Aluguel", "Condomínio", "Energia elétrica", "Água e esgoto"],
    "Alimentação": ["Supermercado", "Feira do mês", "Padaria", "iFood"],
    "Transporte": ["Gasolina", "Uber", "Estacionamento", "Manutenção do carro"],
    "Saúde": ["Plano de saúde", "Farmácia", "Consulta médica"],
    "Educação": ["Curso online", "Material escolar", "Mensalidade"],
    "Lazer": ["Cinema", "Assinatura de streaming", "Passeio no fim de semana"],
    "Telefone": ["Plano de celular"],
    "Internet": ["Internet residencial"]
  };
  var receitas = [["Salário", "Salário mensal"], ["Aluguel", "Aluguel recebido"], ["Freelance", "Projeto extra"], ["Outros", "Rendimento de poupança"]];

  var dias = [5, 7, 10, 12, 15, 18, 20, 22, 25, 28];
  var seed = 42;
  function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
  function round2(n) { return Math.round(n * 100) / 100; }

  var out = [];
  var anoAtual = new Date().getFullYear();

  for (var a = 0; a < 2; a++) {
    var ano = anoAtual - 1 + a;
    for (var m = 0; m < 12; m++) {
      // 1 salário
      out.push(mk(ano, m, 5, "Receita", "Salário", "Salário mensal", round2(4800 + rnd() * 1200), "Recebido"));
      if (rnd() > 0.6) out.push(mk(ano, m, 15, "Receita", "Freelance", "Projeto extra", round2(300 + rnd() * 900), "Recebido"));
      if (m % 3 === 0) out.push(mk(ano, m, 20, "Receita", "Outros", "Rendimento de poupança", round2(40 + rnd() * 160), "Recebido"));

      for (var c = 0; c < categoriasDesp.length; c++) {
        var cat = categoriasDesp[c];
        var qtd = cat === "Cartão de crédito" || cat === "Moradia" ? 2 : (rnd() > 0.45 ? 1 : 0);
        for (var k = 0; k < qtd; k++) {
          var base = { "Cartão de crédito": 1400, "Moradia": 900, "Alimentação": 620, "Transporte": 380, "Saúde": 260, "Educação": 210, "Lazer": 180, "Telefone": 60, "Internet": 110 }[cat];
          var descs = descricoes[cat];
          var pend = rnd() > 0.85;
          out.push(mk(ano, m, dias[(c + k) % dias.length], "Despesa", cat,
            descs[(m + k) % descs.length], round2(base * (0.7 + rnd() * 0.7)),
            pend ? "Pendente" : "Pago"));
        }
      }
    }
  }

  function mk(ano, mes, dia, tipo, categoria, descricao, valor, situacao) {
    var d = new Date(ano, mes, Math.min(dia, new Date(ano, mes + 1, 0).getDate()));
    return {
      data: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"),
      tipo: tipo, categoria: categoria, descricao: descricao, valor: valor,
      situacao: situacao, observacoes: "Dados de exemplo (sintéticos)"
    };
  }

  return out;
})();
