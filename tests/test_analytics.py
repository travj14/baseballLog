"""Tests for splits, pitching, baserunning, and fielding aggregations."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import stats


def _roster(my_players, opp_players=None):
    teams = [{"id": "tm_1", "team_name": "Mine", "my_team": True, "roster": my_players}]
    if opp_players is not None:
        teams.append({"id": "tm_2", "team_name": "Rivals", "my_team": False, "roster": opp_players})
    return teams


def _p(pid, fn, ln, num="1", bats=None, throws=None):
    d = {"id": pid, "first_name": fn, "last_name": ln, "number": num}
    if bats:
        d["bats"] = bats
    if throws:
        d["throws"] = throws
    return d


# --- Splits ---

def test_split_by_zone():
    roster = _roster([_p("b1", "Al", "B")])
    pitches = [
        {"batter_id": "b1", "outcome": "single", "in_zone": True, "balls": 0, "strikes": 0},
        {"batter_id": "b1", "outcome": "out", "in_zone": True, "balls": 1, "strikes": 1},
        {"batter_id": "b1", "outcome": "strikeout", "in_zone": False, "balls": 0, "strikes": 2},
    ]
    games = [{"id": "g1", "opponent_id": "tm_2", "pitches": pitches}]
    rows = stats.compute_splits(games, roster, "zone")
    by_bucket = {r["bucket"]: r for r in rows}
    assert by_bucket["In zone"]["PA"] == 2
    assert by_bucket["In zone"]["H"] == 1
    assert by_bucket["Out of zone"]["PA"] == 1
    assert by_bucket["Out of zone"]["SO"] == 1


def test_split_by_count():
    roster = _roster([_p("b1", "Al", "B")])
    pitches = [
        {"batter_id": "b1", "outcome": "single", "balls": 3, "strikes": 1},
        {"batter_id": "b1", "outcome": "double", "balls": 3, "strikes": 1},
        {"batter_id": "b1", "outcome": "out", "balls": 0, "strikes": 2},
    ]
    games = [{"id": "g1", "pitches": pitches}]
    rows = stats.compute_splits(games, roster, "count")
    by = {r["bucket"]: r for r in rows}
    assert by["3-1"]["H"] == 2
    assert by["0-2"]["AB"] == 1


# --- Pitching ---

def test_pitching_line_and_strike_pct():
    roster = _roster([], [_p("pit", "Cy", "Young")])
    pitches = [
        {"pitcher_id": "pit", "outcome": "strike"},
        {"pitcher_id": "pit", "outcome": "ball"},
        {"pitcher_id": "pit", "outcome": "strikeout"},
        {"pitcher_id": "pit", "outcome": "single"},
        {"pitcher_id": "pit", "outcome": "walk"},
    ]
    baserunning = [
        {"baserunner_id": "x", "ending_base": "home", "pitcher_id": "pit", "earned": True},
        {"baserunner_id": "y", "ending_base": "home", "pitcher_id": "pit", "earned": False},
    ]
    games = [{"id": "g1", "pitches": pitches, "baserunning": baserunning}]
    r = stats.compute_pitching_stats(games, roster)[0]
    assert r["BF"] == 3          # strikeout, single, walk
    assert r["P"] == 5
    assert r["SO"] == 1
    assert r["H"] == 1
    assert r["BB"] == 1
    assert r["R"] == 2
    assert r["ER"] == 1
    # Strikes = strike, strikeout, single = 3 of 5 pitches.
    assert r["Strike%"] == round(3 / 5, 3)


# --- Baserunning ---

def test_baserunning_stats():
    roster = _roster([_p("r1", "Ricky", "Run")])
    baserunning = [
        {"baserunner_id": "r1", "type": "Stolen Base", "out": False, "ending_base": "second"},
        {"baserunner_id": "r1", "type": "Stolen Base", "out": False, "ending_base": "third"},
        {"baserunner_id": "r1", "type": "Caught Stealing", "out": True, "ending_base": None},
        {"baserunner_id": "r1", "type": "Previous Play", "out": False, "ending_base": "home"},
    ]
    games = [{"id": "g1", "baserunning": baserunning}]
    r = stats.compute_baserunning_stats(games, roster)[0]
    assert r["SB"] == 2
    assert r["CS"] == 1
    assert r["R"] == 1
    assert r["OUT"] == 1
    assert r["SB%"] == round(2 / 3, 3)


# --- Fielding ---

def test_split_by_handedness():
    roster = _roster(
        [_p("b1", "Lefty", "Bat", bats="L")],
        [_p("pit", "Righty", "Arm", throws="R")],
    )
    games = [{"id": "g1", "pitches": [
        {"batter_id": "b1", "pitcher_id": "pit", "outcome": "single"},
    ]}]
    bat = stats.compute_splits(games, roster, "bat_side")
    assert bat[0]["bucket"] == "LHB"
    vs = stats.compute_splits(games, roster, "vs_hand")
    assert vs[0]["bucket"] == "vs RHP"


# --- Earned-run reconstruction ---

def test_run_by_runner_who_reached_on_error_is_unearned():
    roster = _roster([], [_p("pit", "Cy", "Young")])
    game = {
        "id": "g1",
        "pitches": [
            {"id": "p1", "inning": 1, "half": "top", "outcome": "error", "batter_id": "e1", "pitcher_id": "pit"},
            {"id": "p2", "inning": 1, "half": "top", "outcome": "single", "batter_id": "b2", "pitcher_id": "pit"},
        ],
        "baserunning": [
            {"baserunner_id": "e1", "ending_base": "home", "pitch_id": "p2", "pitcher_id": "pit", "earned": True},
        ],
    }
    r = stats.compute_pitching_stats([game], roster)[0]
    assert r["R"] == 1
    assert r["ER"] == 0  # e1 reached on error -> unearned


def test_run_after_reconstructed_third_out_is_unearned():
    roster = _roster([], [_p("pit", "Cy", "Young")])
    game = {
        "id": "g1",
        "pitches": [
            {"id": "p1", "inning": 1, "half": "top", "outcome": "error", "batter_id": "e1", "pitcher_id": "pit"},
            {"id": "p2", "inning": 1, "half": "top", "outcome": "out", "batter_id": "b2", "pitcher_id": "pit"},
            {"id": "p3", "inning": 1, "half": "top", "outcome": "out", "batter_id": "b3", "pitcher_id": "pit"},
            {"id": "p4", "inning": 1, "half": "top", "outcome": "single", "batter_id": "b4", "pitcher_id": "pit"},
        ],
        "baserunning": [
            # A clean runner scores, but the inning should already be over
            # (error + 2 outs = 3 reconstructed outs).
            {"baserunner_id": "b4", "ending_base": "home", "pitch_id": "p4", "pitcher_id": "pit", "earned": True},
        ],
    }
    r = stats.compute_pitching_stats([game], roster)[0]
    assert r["R"] == 1
    assert r["ER"] == 0


def test_clean_run_is_earned():
    roster = _roster([], [_p("pit", "Cy", "Young")])
    game = {
        "id": "g1",
        "pitches": [
            {"id": "p1", "inning": 1, "half": "top", "outcome": "single", "batter_id": "b1", "pitcher_id": "pit"},
        ],
        "baserunning": [
            {"baserunner_id": "b1", "ending_base": "home", "pitch_id": "p1", "pitcher_id": "pit", "earned": True},
        ],
    }
    r = stats.compute_pitching_stats([game], roster)[0]
    assert r["R"] == 1
    assert r["ER"] == 1


# --- Detailed fielding ---

def test_fielding_double_play_chain():
    roster = _roster([], [_p("f6", "S", "S", num="6"), _p("f4", "T", "B", num="4"), _p("f3", "F", "B", num="3")])
    game = {
        "id": "g1",
        "away_lineup": [
            {"id": "f6", "position": "6"}, {"id": "f4", "position": "4"}, {"id": "f3", "position": "3"},
        ],
        "home_lineup": [],
        "pitches": [
            {"id": "p1", "half": "bottom", "outcome": "out", "fielding_play": ["6", "4", "3"]},
        ],
        "baserunning": [
            {"baserunner_id": "r1", "pitch_id": "p1", "out": True},  # lead runner out -> 2 outs = DP
        ],
    }
    rows = {r["player_id"]: r for r in stats.compute_fielding_stats([game], roster)}
    assert rows["f3"]["PO"] == 1 and rows["f3"]["A"] == 0
    assert rows["f6"]["A"] == 1 and rows["f4"]["A"] == 1
    assert all(rows[f]["DP"] == 1 for f in ("f3", "f4", "f6"))
    assert rows["f6"]["POS"] == "SS"


def test_fielding_stats_resolve_position_to_player():
    # Away team fields in the bottom half; SS (pos 6) is f1.
    roster = _roster([], [_p("f1", "Ozzie", "Smith")])
    games = [{
        "id": "g1",
        "away_lineup": [{"id": "f1", "position": "6"}],
        "home_lineup": [],
        "pitches": [
            {"outcome": "out", "half": "bottom", "fielded_by": "6"},
            {"outcome": "out", "half": "bottom", "fielded_by": "6"},
            {"outcome": "error", "half": "bottom", "fielded_by": "6"},
            {"outcome": "single", "half": "bottom"},  # no fielded_by -> ignored
        ],
    }]
    r = stats.compute_fielding_stats(games, roster)[0]
    assert r["POS"] == "SS"
    assert r["PO"] == 2
    assert r["E"] == 1
    assert r["CH"] == 3
    assert r["FLD%"] == round(2 / 3, 3)
