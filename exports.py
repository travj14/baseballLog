"""Pure export builders (CSV / HTML) for Baseball Log.

No filesystem or webview dependency: these take already-computed stat rows and
return strings. app.py is responsible for writing them to disk.
"""

import csv
import html
import io

# Column order shared by the CSV and HTML exports.
COUNTING_COLS = ["PA", "AB", "H", "1B", "2B", "3B", "HR", "BB", "HBP", "SO", "SF", "SH", "TB"]
RATE_COLS = ["AVG", "OBP", "SLG", "OPS", "wOBA"]


def _fmt_rate(value):
    """Baseball convention: rates below 1 drop the leading zero (.333)."""
    v = float(value or 0)
    s = f"{v:.3f}"
    return s[1:] if 0 <= v < 1 else s


def batting_csv(rows):
    """Return a CSV string for the given batting stat rows."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    header = ["Player", "Number"] + COUNTING_COLS + RATE_COLS
    writer.writerow(header)
    for r in rows:
        line = [r.get("name", ""), r.get("number", "")]
        line += [r.get(c, 0) for c in COUNTING_COLS]
        line += [_fmt_rate(r.get(c, 0)) for c in RATE_COLS]
        writer.writerow(line)
    return buf.getvalue()


def _totals(rows):
    totals = {c: 0 for c in COUNTING_COLS}
    for r in rows:
        for c in COUNTING_COLS:
            totals[c] += r.get(c, 0) or 0
    ab, h, bb, hbp, sf = totals["AB"], totals["H"], totals["BB"], totals["HBP"], totals["SF"]
    den = ab + bb + hbp + sf
    totals["AVG"] = h / ab if ab else 0.0
    totals["OBP"] = (h + bb + hbp) / den if den else 0.0
    totals["SLG"] = totals["TB"] / ab if ab else 0.0
    totals["OPS"] = totals["OBP"] + totals["SLG"]
    w = {"BB": 0.69, "HBP": 0.72, "1B": 0.89, "2B": 1.27, "3B": 1.62, "HR": 2.10}
    woba_num = (w["BB"] * bb + w["HBP"] * hbp + w["1B"] * totals["1B"]
                + w["2B"] * totals["2B"] + w["3B"] * totals["3B"] + w["HR"] * totals["HR"])
    totals["wOBA"] = woba_num / den if den else 0.0
    return totals


def html_summary(team_name, rows, generated_on, scope_label="All games"):
    """Return a self-contained HTML report string for the batting stat rows."""
    esc = html.escape
    head_cells = "".join(f"<th>{esc(c)}</th>" for c in (COUNTING_COLS + RATE_COLS))

    body_rows = []
    for r in rows:
        num = f"#{esc(str(r.get('number', '')))} " if r.get("number") else ""
        cells = [f'<td class="name">{num}{esc(r.get("name", ""))}</td>']
        cells += [f"<td>{r.get(c, 0)}</td>" for c in COUNTING_COLS]
        cells += [f'<td class="rate">{_fmt_rate(r.get(c, 0))}</td>' for c in RATE_COLS]
        body_rows.append("<tr>" + "".join(cells) + "</tr>")

    totals = _totals(rows)
    tcells = ['<td class="name">Team totals</td>']
    tcells += [f"<td>{totals.get(c, 0)}</td>" for c in COUNTING_COLS]
    tcells += [f'<td class="rate">{_fmt_rate(totals.get(c, 0))}</td>' for c in RATE_COLS]
    total_row = '<tr class="total">' + "".join(tcells) + "</tr>"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{esc(team_name)} — Batting Summary</title>
<style>
  body {{ font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #0b0b0b; margin: 32px; background: #f9f9f7; }}
  h1 {{ margin: 0 0 4px; font-size: 22px; }}
  .meta {{ color: #52514e; font-size: 13px; margin-bottom: 20px; }}
  table {{ border-collapse: collapse; width: 100%; background: #fff; font-size: 13px; }}
  th, td {{ padding: 8px 10px; text-align: right; border-bottom: 1px solid #eef2f7; }}
  th {{ background: #1f2937; color: #fff; }}
  td.name, th.name {{ text-align: left; font-weight: 600; }}
  td.rate {{ color: #1d4ed8; font-variant-numeric: tabular-nums; }}
  tr.total td {{ background: #f1f5f9; font-weight: 700; border-top: 2px solid #cbd5e1; }}
</style>
</head>
<body>
<h1>{esc(team_name)} — Batting Summary</h1>
<div class="meta">{esc(scope_label)} · generated {esc(generated_on)}</div>
<table>
<thead><tr><th class="name">Player</th>{head_cells}</tr></thead>
<tbody>{"".join(body_rows)}</tbody>
<tfoot>{total_row}</tfoot>
</table>
</body>
</html>
"""


def _stats_table_html(rows):
    """Reusable batting table markup (thead + body + totals footer)."""
    esc = html.escape
    head_cells = "".join(f"<th>{esc(c)}</th>" for c in (COUNTING_COLS + RATE_COLS))

    body_rows = []
    for r in rows:
        num = f"#{esc(str(r.get('number', '')))} " if r.get("number") else ""
        cells = [f'<td class="name">{num}{esc(r.get("name", ""))}</td>']
        cells += [f"<td>{r.get(c, 0)}</td>" for c in COUNTING_COLS]
        cells += [f'<td class="rate">{_fmt_rate(r.get(c, 0))}</td>' for c in RATE_COLS]
        body_rows.append("<tr>" + "".join(cells) + "</tr>")

    totals = _totals(rows)
    tcells = ['<td class="name">Team totals</td>']
    tcells += [f"<td>{totals.get(c, 0)}</td>" for c in COUNTING_COLS]
    tcells += [f'<td class="rate">{_fmt_rate(totals.get(c, 0))}</td>' for c in RATE_COLS]
    total_row = '<tr class="total">' + "".join(tcells) + "</tr>"

    return (
        f'<table><thead><tr><th class="name">Player</th>{head_cells}</tr></thead>'
        f'<tbody>{"".join(body_rows)}</tbody><tfoot>{total_row}</tfoot></table>'
    )


def game_summary_html(team_name, opponent, home_away, my_score, opp_score,
                      result, rows, generated_on):
    """A print-optimized single-game recap (scorebook-style). Open in a browser
    and print to PDF for sharing."""
    esc = html.escape
    matchup = f"{esc(team_name)} {'vs' if home_away == 'home' else '@'} {esc(opponent)}"
    result_word = {"W": "Win", "L": "Loss", "T": "Tie"}.get(result, "In progress")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{matchup} — Game Summary</title>
<style>
  body {{ font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #0b0b0b; margin: 32px; background: #fff; }}
  h1 {{ margin: 0 0 4px; font-size: 22px; }}
  .scoreline {{ font-size: 32px; font-weight: 700; margin: 12px 0 2px; }}
  .result {{ color: #52514e; font-size: 14px; margin-bottom: 4px; }}
  .meta {{ color: #898781; font-size: 12px; margin-bottom: 20px; }}
  h2 {{ font-size: 15px; margin: 24px 0 8px; }}
  table {{ border-collapse: collapse; width: 100%; font-size: 13px; }}
  th, td {{ padding: 7px 9px; text-align: right; border-bottom: 1px solid #eef2f7; }}
  th {{ background: #1f2937; color: #fff; }}
  td.name, th.name {{ text-align: left; font-weight: 600; }}
  td.rate {{ color: #1d4ed8; font-variant-numeric: tabular-nums; }}
  tr.total td {{ background: #f1f5f9; font-weight: 700; border-top: 2px solid #cbd5e1; }}
  @media print {{ body {{ margin: 0; }} th {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }} }}
</style>
</head>
<body>
<h1>{matchup}</h1>
<div class="scoreline">{my_score} &ndash; {opp_score}</div>
<div class="result">{esc(result_word)}</div>
<div class="meta">generated {esc(generated_on)}</div>
<h2>Batting</h2>
{_stats_table_html(rows)}
</body>
</html>
"""


def season_csv(game_log):
    """CSV of the per-game season log (one row per game)."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Game", "Opponent", "Home/Away", "Result", "Runs For", "Runs Against", "Status"])
    for row in game_log:
        writer.writerow([
            row.get("game_id", ""),
            row.get("opponent", ""),
            "Home" if row.get("home_away") == "home" else "Away",
            row.get("result") or "",
            row.get("my_score", 0),
            row.get("opp_score", 0),
            row.get("status", ""),
        ])
    return buf.getvalue()
