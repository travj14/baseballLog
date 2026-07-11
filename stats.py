"""Pure stat-computation helpers for Baseball Log.

Kept free of any webview/filesystem dependency so it can be unit tested and
reused. All functions take already-loaded plain data (lists/dicts parsed from
the JSON files) and return plain data.
"""

# Outcomes recorded on a pitch that end a plate appearance. Anything else
# (ball, strike, foul, foul tip) is a non-terminal pitch within a PA.
PA_OUTCOMES = {
    "strikeout",
    "walk",
    "hbp",
    "single",
    "double",
    "triple",
    "home_run",
    "out",
    "error",
    "sac_fly",
    "sac_bunt",
    "fielders_choice",
}

HIT_OUTCOMES = {"single", "double", "triple", "home_run"}

# Total bases per hit type, used for SLG and wOBA.
TOTAL_BASES = {"single": 1, "double": 2, "triple": 3, "home_run": 4}

# wOBA linear weights. These are MLB-style defaults (roughly the FanGraphs
# constants); the product doc flags exact youth weights as an open question, so
# they live here as one clearly-labeled knob to change later.
WOBA_WEIGHTS = {
    "walk": 0.69,
    "hbp": 0.72,
    "single": 0.89,
    "double": 1.27,
    "triple": 1.62,
    "home_run": 2.10,
}


def _blank_line():
    return {
        "PA": 0,
        "AB": 0,
        "H": 0,
        "1B": 0,
        "2B": 0,
        "3B": 0,
        "HR": 0,
        "BB": 0,
        "HBP": 0,
        "SO": 0,
        "SF": 0,   # sacrifice flies
        "SH": 0,   # sacrifice hits (bunts)
    }


def _finalize(line):
    """Add derived rate stats (AVG/OBP/SLG/OPS/wOBA) to a counting line."""
    ab = line["AB"]
    h = line["H"]
    bb = line["BB"]
    hbp = line["HBP"]

    sf = line["SF"]
    total_bases = line["1B"] + 2 * line["2B"] + 3 * line["3B"] + 4 * line["HR"]
    on_base_num = h + bb + hbp
    # Official OBP/wOBA denominator: AB + BB + HBP + SF (sac bunts excluded).
    on_base_den = ab + bb + hbp + sf

    woba_num = (
        WOBA_WEIGHTS["walk"] * bb
        + WOBA_WEIGHTS["hbp"] * hbp
        + WOBA_WEIGHTS["single"] * line["1B"]
        + WOBA_WEIGHTS["double"] * line["2B"]
        + WOBA_WEIGHTS["triple"] * line["3B"]
        + WOBA_WEIGHTS["home_run"] * line["HR"]
    )

    line["TB"] = total_bases
    line["AVG"] = round(h / ab, 3) if ab else 0.0
    line["OBP"] = round(on_base_num / on_base_den, 3) if on_base_den else 0.0
    line["SLG"] = round(total_bases / ab, 3) if ab else 0.0
    line["OPS"] = round(line["OBP"] + line["SLG"], 3)
    line["wOBA"] = round(woba_num / on_base_den, 3) if on_base_den else 0.0
    return line


def _apply_outcome(line, outcome):
    """Fold a single plate-appearance-ending outcome into a counting line."""
    if outcome not in PA_OUTCOMES:
        return
    line["PA"] += 1

    # Walk, HBP, and sacrifices are not at-bats; everything else terminal is.
    if outcome == "walk":
        line["BB"] += 1
        return
    if outcome == "hbp":
        line["HBP"] += 1
        return
    if outcome == "sac_fly":
        line["SF"] += 1
        return
    if outcome == "sac_bunt":
        line["SH"] += 1
        return

    line["AB"] += 1

    if outcome == "strikeout":
        line["SO"] += 1
    elif outcome in HIT_OUTCOMES:
        line["H"] += 1
        if outcome == "single":
            line["1B"] += 1
        elif outcome == "double":
            line["2B"] += 1
        elif outcome == "triple":
            line["3B"] += 1
        elif outcome == "home_run":
            line["HR"] += 1
    # "out", "error", and "fielders_choice" are at-bats with no hit.


def compute_batting_stats(games, roster_teams, game_id=None, player_ids=None):
    """Aggregate batting stats across games.

    games:        list of game dicts (each with a "pitches" list).
    roster_teams: list of team dicts (each with "roster") used to attach player
                  names/numbers and to scope which batters to include.
    game_id:      if given, only that game's pitches are counted.
    player_ids:   if given, only these batter ids are included; otherwise every
                  batter found across the roster teams is included.

    Returns a list of stat lines (one per player that has at least one PA),
    sorted by descending PA then name.
    """
    # Build id -> player info map from the rosters.
    player_info = {}
    for team in roster_teams:
        for p in team.get("roster", []):
            player_info[p["id"]] = {
                "player_id": p["id"],
                "number": p.get("number", ""),
                "name": f"{p.get('first_name', '')} {p.get('last_name', '')}".strip(),
                "team_id": team["id"],
                "team_name": team.get("team_name", ""),
                "my_team": team.get("my_team", False),
            }

    allowed = set(player_ids) if player_ids is not None else None

    lines = {}
    for game in games:
        if game_id is not None and game.get("id") != game_id:
            continue
        for pitch in game.get("pitches", []):
            outcome = pitch.get("outcome")
            if outcome not in PA_OUTCOMES:
                continue
            batter_id = pitch.get("batter_id")
            if not batter_id:
                continue
            if allowed is not None and batter_id not in allowed:
                continue
            if batter_id not in lines:
                lines[batter_id] = _blank_line()
            _apply_outcome(lines[batter_id], outcome)

    result = []
    for batter_id, line in lines.items():
        info = player_info.get(batter_id, {
            "player_id": batter_id,
            "number": "",
            "name": batter_id,
            "team_id": None,
            "team_name": "",
            "my_team": False,
        })
        row = dict(info)
        row.update(_finalize(line))
        result.append(row)

    result.sort(key=lambda r: (-r["PA"], r["name"]))
    return result


def compute_game_log(games, roster_teams):
    """Per-game results from my team's perspective (one row per game)."""
    name_map = {t["id"]: t.get("team_name", "") for t in roster_teams}

    log = []
    for g in games:
        home_away = g.get("home_away", "home")
        hs = g.get("home_score", 0)
        as_ = g.get("away_score", 0)
        if home_away == "home":
            my_score, opp_score = hs, as_
        else:
            my_score, opp_score = as_, hs

        status = g.get("status", "upcoming")
        result = None
        if status == "complete":
            result = "W" if my_score > opp_score else ("L" if my_score < opp_score else "T")

        log.append({
            "game_id": g.get("id"),
            "opponent": name_map.get(g.get("opponent_id"), g.get("opponent_id")),
            "home_away": home_away,
            "my_score": my_score,
            "opp_score": opp_score,
            "status": status,
            "result": result,
        })
    return log


def compute_season_record(game_log):
    """Aggregate a game log into a season record and run totals."""
    wins = losses = ties = games_played = 0
    runs_for = runs_against = 0
    for row in game_log:
        runs_for += row["my_score"]
        runs_against += row["opp_score"]
        if row["status"] == "complete":
            games_played += 1
            if row["result"] == "W":
                wins += 1
            elif row["result"] == "L":
                losses += 1
            else:
                ties += 1
    return {
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "games_played": games_played,
        "runs_for": runs_for,
        "runs_against": runs_against,
        "run_diff": runs_for - runs_against,
    }


# ===== Splits =====

_BATS_LABEL = {"L": "LHB", "R": "RHB", "S": "Switch"}
_THROWS_LABEL = {"L": "vs LHP", "R": "vs RHP"}


def _split_key(pitch, game, dimension, name_map, bats_map, throws_map):
    """Bucket label for a terminal pitch under the chosen split dimension."""
    if dimension == "count":
        return f"{pitch.get('balls', 0)}-{pitch.get('strikes', 0)}"
    if dimension == "inning":
        return f"Inn {pitch.get('inning', '?')}"
    if dimension == "zone":
        return "In zone" if pitch.get("in_zone") else "Out of zone"
    if dimension == "pitch_type":
        return pitch.get("pitch_type") or "Unspecified"
    if dimension == "opponent":
        return name_map.get(game.get("opponent_id"), game.get("opponent_id") or "?")
    if dimension == "bat_side":
        return _BATS_LABEL.get(bats_map.get(pitch.get("batter_id")), "Unknown")
    if dimension == "vs_hand":
        return _THROWS_LABEL.get(throws_map.get(pitch.get("pitcher_id")), "Unknown")
    if dimension == "baseout":
        r = pitch.get("runners") or {}
        occ = "".join(b for b, k in (("1", "first_id"), ("2", "second_id"), ("3", "third_id")) if r.get(k))
        return f"{pitch.get('outs', 0)} out, {occ or 'bases empty'}"
    return "All"


def compute_splits(games, roster_teams, dimension, player_ids=None, game_id=None):
    """Batting stat lines bucketed by a split dimension (count, inning, zone,
    pitch_type, opponent, bat_side, vs_hand, or baseout)."""
    name_map = {t["id"]: t.get("team_name", "") for t in roster_teams}
    bats_map, throws_map = {}, {}
    for team in roster_teams:
        for p in team.get("roster", []):
            if p.get("bats"):
                bats_map[p["id"]] = p["bats"]
            if p.get("throws"):
                throws_map[p["id"]] = p["throws"]
    allowed = set(player_ids) if player_ids is not None else None

    buckets = {}
    for game in games:
        if game_id is not None and game.get("id") != game_id:
            continue
        for pitch in game.get("pitches", []):
            outcome = pitch.get("outcome")
            if outcome not in PA_OUTCOMES:
                continue
            batter_id = pitch.get("batter_id")
            if not batter_id:
                continue
            if allowed is not None and batter_id not in allowed:
                continue
            key = _split_key(pitch, game, dimension, name_map, bats_map, throws_map)
            if key not in buckets:
                buckets[key] = _blank_line()
            _apply_outcome(buckets[key], outcome)

    result = []
    for key, line in buckets.items():
        row = {"bucket": key}
        row.update(_finalize(line))
        result.append(row)
    result.sort(key=lambda r: (-r["PA"], r["bucket"]))
    return result


# ===== Pitching =====

# Pitches that are not strikes (everything else — called/swinging/foul/in-play — is).
NON_STRIKE_OUTCOMES = {"ball", "walk", "hbp"}


def _blank_pitching():
    return {"BF": 0, "P": 0, "H": 0, "SO": 0, "BB": 0, "HBP": 0, "R": 0, "ER": 0, "_strikes": 0}


# Batter outcomes that put the batter out (for reconstructed-out counting).
_BATTER_OUT_OUTCOMES = {"strikeout", "out", "sac_fly", "sac_bunt"}


def _game_earned_runs(game):
    """Heuristic earned-run reconstruction, per pitcher, for one game.

    A run is charged unearned when: the scorer flagged it unearned, OR the
    scoring runner reached base on an error, OR it scored after the inning
    *should* have ended (3 reconstructed outs, counting reached-on-errors as
    outs that should have been made). This is a practical reconstruction — it
    does not model errors that let existing runners take extra bases or score,
    which the scorer can still mark unearned by hand.
    """
    from collections import defaultdict

    runs_by_pitch = defaultdict(list)
    for ev in game.get("baserunning", []):
        if ev.get("ending_base") == "home" and not ev.get("out"):
            runs_by_pitch[ev.get("pitch_id")].append(ev)
    br_outs_by_pitch = defaultdict(int)
    for ev in game.get("baserunning", []):
        if ev.get("out"):
            br_outs_by_pitch[ev.get("pitch_id")] += 1

    result = defaultdict(lambda: {"R": 0, "ER": 0})

    def credit(runs, recon_outs, roe):
        for ev in runs:
            pid = ev.get("pitcher_id")
            result[pid]["R"] += 1
            unearned = (ev.get("earned") is False
                        or recon_outs >= 3
                        or ev.get("baserunner_id") in roe)
            if not unearned:
                result[pid]["ER"] += 1

    cur_key = None
    recon_outs = 0
    roe = set()
    for p in game.get("pitches", []):
        key = (p.get("inning"), p.get("half"))
        if key != cur_key:
            cur_key, recon_outs, roe = key, 0, set()
        # Runs on this play are judged against outs accrued before it.
        credit(runs_by_pitch.pop(p.get("id"), []), recon_outs, roe)
        outcome = p.get("outcome")
        if outcome in _BATTER_OUT_OUTCOMES or outcome == "fielders_choice":
            recon_outs += 1
        elif outcome == "error":
            recon_outs += 1  # should have been an out
            if p.get("batter_id"):
                roe.add(p["batter_id"])
        recon_outs += br_outs_by_pitch.get(p.get("id"), 0)

    # Runs whose pitch couldn't be matched: count them, honor the manual flag.
    for runs in runs_by_pitch.values():
        for ev in runs:
            result[ev.get("pitcher_id")]["R"] += 1
            if ev.get("earned") is not False:
                result[ev.get("pitcher_id")]["ER"] += 1
    return result


def _finalize_pitching(line):
    p = line["P"]
    line["Strike%"] = round(line["_strikes"] / p, 3) if p else 0.0
    del line["_strikes"]
    return line


def compute_pitching_stats(games, roster_teams, pitcher_ids=None, game_id=None):
    """Per-pitcher lines: batters faced, pitches, hits, K, BB, HBP, R, ER,
    strike%. Runs come from scored baserunning events (ending_base == home)."""
    name_map = {}
    for team in roster_teams:
        for p in team.get("roster", []):
            name_map[p["id"]] = {
                "player_id": p["id"],
                "number": p.get("number", ""),
                "name": f"{p.get('first_name', '')} {p.get('last_name', '')}".strip(),
            }
    allowed = set(pitcher_ids) if pitcher_ids is not None else None

    lines = {}

    def line_for(pid):
        if pid not in lines:
            lines[pid] = _blank_pitching()
        return lines[pid]

    for game in games:
        if game_id is not None and game.get("id") != game_id:
            continue
        for pitch in game.get("pitches", []):
            pid = pitch.get("pitcher_id")
            if not pid or (allowed is not None and pid not in allowed):
                continue
            L = line_for(pid)
            L["P"] += 1
            outcome = pitch.get("outcome")
            if outcome not in NON_STRIKE_OUTCOMES:
                L["_strikes"] += 1
            if outcome in PA_OUTCOMES:
                L["BF"] += 1
                if outcome in HIT_OUTCOMES:
                    L["H"] += 1
                elif outcome == "strikeout":
                    L["SO"] += 1
                elif outcome == "walk":
                    L["BB"] += 1
                elif outcome == "hbp":
                    L["HBP"] += 1
        # Runs (R) and earned runs (ER) via inning reconstruction.
        for pid, rr in _game_earned_runs(game).items():
            if not pid or (allowed is not None and pid not in allowed):
                continue
            L = line_for(pid)
            L["R"] += rr["R"]
            L["ER"] += rr["ER"]

    result = []
    for pid, line in lines.items():
        info = name_map.get(pid, {"player_id": pid, "number": "", "name": pid})
        row = dict(info)
        row.update(_finalize_pitching(line))
        result.append(row)
    result.sort(key=lambda r: (-r["BF"], r["name"]))
    return result


# ===== Baserunning =====

def compute_baserunning_stats(games, roster_teams, player_ids=None, game_id=None):
    """Per-runner lines: stolen bases, caught stealing, pickoffs, runs scored,
    and outs on the bases, from recorded baserunning events."""
    name_map = {}
    for team in roster_teams:
        for p in team.get("roster", []):
            name_map[p["id"]] = {
                "player_id": p["id"],
                "number": p.get("number", ""),
                "name": f"{p.get('first_name', '')} {p.get('last_name', '')}".strip(),
            }
    allowed = set(player_ids) if player_ids is not None else None

    lines = {}
    for game in games:
        if game_id is not None and game.get("id") != game_id:
            continue
        for ev in game.get("baserunning", []):
            rid = ev.get("baserunner_id")
            if not rid or (allowed is not None and rid not in allowed):
                continue
            L = lines.setdefault(rid, {"SB": 0, "CS": 0, "PO": 0, "R": 0, "OUT": 0})
            etype = ev.get("type")
            is_out = ev.get("out")
            if etype == "Stolen Base" and not is_out:
                L["SB"] += 1
            elif etype == "Caught Stealing":
                L["CS"] += 1
            elif etype == "Picked Off":
                L["PO"] += 1
            if ev.get("ending_base") == "home" and not is_out:
                L["R"] += 1
            if is_out:
                L["OUT"] += 1

    result = []
    for rid, line in lines.items():
        info = name_map.get(rid, {"player_id": rid, "number": "", "name": rid})
        row = dict(info)
        attempts = line["SB"] + line["CS"]
        row.update(line)
        row["SB%"] = round(line["SB"] / attempts, 3) if attempts else 0.0
        result.append(row)
    result.sort(key=lambda r: (-(r["SB"] + r["R"]), r["name"]))
    return result


# ===== Fielding =====

# Standard scorekeeping position numbers.
POSITION_LABELS = {
    "1": "P", "2": "C", "3": "1B", "4": "2B", "5": "3B",
    "6": "SS", "7": "LF", "8": "CF", "9": "RF",
    "P": "P", "C": "C",
}


def compute_fielding_stats(games, roster_teams, player_ids=None, game_id=None):
    """Per-fielder putouts, assists, errors, and double plays.

    Reads the ordered `fielding_play` chain on in-play pitches (e.g. ["6","4","3"]
    for a 6-4-3): the last fielder is credited the putout, the rest assists; an
    error charges the last fielder in the chain. A play with 2+ outs (batter out
    plus a runner out on the same pitch) counts a double play for each fielder in
    the chain. Falls back to the single `fielded_by` field for older data."""
    from collections import defaultdict

    name_map = {}
    for team in roster_teams:
        for p in team.get("roster", []):
            name_map[p["id"]] = {
                "player_id": p["id"],
                "number": p.get("number", ""),
                "name": f"{p.get('first_name', '')} {p.get('last_name', '')}".strip(),
            }
    allowed = set(player_ids) if player_ids is not None else None

    def lineup_pos_map(lineup):
        m = {}
        for entry in lineup or []:
            if isinstance(entry, dict) and entry.get("position"):
                m[str(entry["position"])] = entry["id"]
        return m

    def blank(pos):
        return {"POS": POSITION_LABELS.get(pos, pos), "PO": 0, "A": 0, "E": 0, "DP": 0}

    lines = {}
    for game in games:
        if game_id is not None and game.get("id") != game_id:
            continue
        home_map = lineup_pos_map(game.get("home_lineup"))
        away_map = lineup_pos_map(game.get("away_lineup"))
        br_outs = defaultdict(int)
        for ev in game.get("baserunning", []):
            if ev.get("out"):
                br_outs[ev.get("pitch_id")] += 1

        for pitch in game.get("pitches", []):
            chain = pitch.get("fielding_play")
            if not chain:
                fb = pitch.get("fielded_by")
                chain = [fb] if fb else []
            chain = [str(c) for c in chain if c]
            if not chain:
                continue

            fmap = home_map if pitch.get("half") == "top" else away_map
            outcome = pitch.get("outcome")
            outs_on_play = (1 if outcome in _BATTER_OUT_OUTCOMES else 0) + br_outs.get(pitch.get("id"), 0)
            is_dp = outs_on_play >= 2

            def fielder_line(pos):
                fid = fmap.get(pos)
                if not fid or (allowed is not None and fid not in allowed):
                    return None
                return lines.setdefault(fid, blank(pos))

            if outcome == "error":
                L = fielder_line(chain[-1])
                if L:
                    L["E"] += 1
            else:
                for i, pos in enumerate(chain):
                    L = fielder_line(pos)
                    if not L:
                        continue
                    if i == len(chain) - 1:
                        L["PO"] += 1
                    else:
                        L["A"] += 1
                    if is_dp:
                        L["DP"] += 1

    result = []
    for fid, line in lines.items():
        info = name_map.get(fid, {"player_id": fid, "number": "", "name": fid})
        row = dict(info)
        row.update(line)
        row["CH"] = line["PO"] + line["A"] + line["E"]
        row["FLD%"] = round((line["PO"] + line["A"]) / row["CH"], 3) if row["CH"] else 0.0
        result.append(row)
    result.sort(key=lambda r: (-r["CH"], r["name"]))
    return result
