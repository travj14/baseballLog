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


def _p(pid, fn, ln, num="1"):
    return {"id": pid, "first_name": fn, "last_name": ln, "number": num}


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
