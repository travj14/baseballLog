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
