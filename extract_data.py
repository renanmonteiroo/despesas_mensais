"""Extrai os dados do Controle_Financeiro_Profissional.xlsx para JSON."""
import openpyxl, json, datetime, io, os, sys

BASE = os.path.dirname(os.path.abspath(__file__))
XLSX = os.path.join(BASE, "Controle_Financeiro_Profissional.xlsx")
# Saída LOCAL apenas. Nunca coloque esta pasta dentro de "site/" (site/ é publicado
# na internet e os seus lançamentos ficariam expostos). O site importa o .xlsx
# direto no navegador, então este script é opcional.
OUT_DIR = os.path.join(BASE, "dados_extraidos")

os.makedirs(OUT_DIR, exist_ok=True)
wb = openpyxl.load_workbook(XLSX, data_only=True)

def sheet(name_idx):
    if isinstance(name_idx, int):
        return wb.worksheets[name_idx]
    return wb[name_idx]

# ---------- Lançamentos ----------
ws = wb.worksheets[1]  # aba "Lançamentos"
lanc = []
for r in ws.iter_rows(min_row=2, values_only=True):
    if r[0] is None and r[3] is None:
        continue
    d = r[0]
    lanc.append({
        "data": d.strftime("%Y-%m-%d") if isinstance(d, datetime.datetime) else (d or ""),
        "tipo": r[1] or "",
        "categoria": r[2] or "",
        "descricao": r[3] or "",
        "valor": float(r[4]) if isinstance(r[4], (int, float)) else 0.0,
        "situacao": r[5] or "",
        "observacoes": r[6] or "",
        "mes": r[7] or "",
        "ano": r[8] if isinstance(r[8], int) else (int(r[8]) if r[8] else None),
    })

# ---------- Listas (categorias / tipos / situações) ----------
ws_list = wb["Listas"]
tipos, situacoes, categorias = [], [], []
for r in ws_list.iter_rows(min_row=2, values_only=True):
    if r[0]: tipos.append(r[0])
    if r[1]: situacoes.append(r[1])
    if r[2]: categorias.append(r[2])

# ---------- Painel (totais e série mensal) ----------
ws_painel = wb["Painel"]
painel = {
    "ano": ws_painel["B2"].value,
    "receitas": ws_painel["B4"].value,
    "despesas": ws_painel["D4"].value,
    "saldo": ws_painel["F4"].value,
    "taxa": ws_painel["H4"].value,
    "mensal": [],
}
for row in ws_painel.iter_rows(min_row=10, max_row=21, values_only=True):
    if row[0] is None:
        continue
    m = row[0]
    painel["mensal"].append({
        "mes": m.strftime("%b").lower() if isinstance(m, datetime.datetime) else str(m),
        "receitas": row[1] or 0,
        "despesas": row[2] or 0,
        "saldo": row[3] or 0,
        "pendentes": row[4] or 0,
    })

# ---------- Resumo anual por categoria ----------
resumo = []
ws_res = wb["Resumo Anual"]
for row in ws_res.iter_rows(min_row=5, values_only=True):
    if not row[1]:
        continue
    resumo.append({
        "tipo": row[0], "categoria": row[1], "total": row[2] or 0,
        "participacao": row[3] or 0,
    })

data = {
    "origem": "Controle_Financeiro_Profissional.xlsx",
    "lancamentos": lanc,
    "listas": {"tipos": tipos, "situacoes": situacoes, "categorias": categorias},
    "painel": painel,
    "resumoAnual": resumo,
}

for fname, payload in [
    ("lancamentos.json", lanc),
    ("listas.json", data["listas"]),
    ("painel.json", painel),
    ("resumo-anual.json", resumo),
    ("dados.json", data),
]:
    with io.open(os.path.join(OUT_DIR, fname), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)

print("lancamentos:", len(lanc))
print("categorias:", len(categorias))
print("mensal:", len(painel["mensal"]))
print("resumo:", len(resumo))
