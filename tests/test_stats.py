"""Tests for the batting-stat computation engine (stats.py)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import stats


def _pitch(batter_id, outcome, pitcher_id="pit_1"):
    return {"batter_id": batter_id, "pitcher_id": pitcher_id, "outcome": outcome}


def _roster(players):
    return [{
        "id": "tm_1",
        "team_name": "Testers",
        "my_team": True,
        "roster": players,
    }]


def _player(pid, first, last, number="1"):
    return {"id": pid, "first_name": first, "last_name": last, "number": number}


def test_counting_stats_from_outcomes():
    roster = _roster([_player("p1", "Al", "Batter")])
    pitches = [
        _pitch("p1", "single"),
        _pitch("p1", "double"),
        _pitch("p1", "triple"),
        _pitch("p1", "home_run"),
        _pitch("p1", "walk"),
        _pitch("p1", "hbp"),
        _pitch("p1", "strikeout"),
        _pitch("p1", "out"),
        _pitch("p1", "error"),
        # Non-terminal pitches must not count as plate appearances.
        _pitch("p1", "ball"),
        _pitch("p1", "strike"),
        _pitch("p1", "foul"),
    ]
    games = [{"id": "g1", "pitches": pitches}]

    rows = stats.compute_batting_stats(games, roster)
    assert len(rows) == 1
    r = rows[0]

    assert r["PA"] == 9              # 9 terminal outcomes
    assert r["AB"] == 7             # PA minus walk and hbp
    assert r["H"] == 4
    assert (r["1B"], r["2B"], r["3B"], r["HR"]) == (1, 1, 1, 1)
    assert r["BB"] == 1
    assert r["HBP"] == 1
    assert r["SO"] == 1
    assert r["TB"] == 1 + 2 + 3 + 4


def test_rate_stats():
    # 1-for-4 with a double, one walk.
    roster = _roster([_player("p1", "Al", "Batter")])
    pitches = [
        _pitch("p1", "double"),
        _pitch("p1", "out"),
        _pitch("p1", "out"),
        _pitch("p1", "strikeout"),
        _pitch("p1", "walk"),
    ]
    games = [{"id": "g1", "pitches": pitches}]
    r = stats.compute_batting_stats(games, roster)[0]

    assert r["AB"] == 4
    assert r["AVG"] == round(1 / 4, 3)
    # OBP = (H + BB + HBP) / (AB + BB + HBP) = 2 / 5
    assert r["OBP"] == round(2 / 5, 3)
    # SLG = TB / AB = 2 / 4
    assert r["SLG"] == round(2 / 4, 3)
    assert r["OPS"] == round(r["OBP"] + r["SLG"], 3)


def test_reached_on_error_is_ab_not_hit():
    roster = _roster([_player("p1", "Al", "Batter")])
    games = [{"id": "g1", "pitches": [_pitch("p1", "error")]}]
    r = stats.compute_batting_stats(games, roster)[0]
    assert r["AB"] == 1
    assert r["H"] == 0
    assert r["AVG"] == 0.0


def test_zero_ab_rates_do_not_divide_by_zero():
    roster = _roster([_player("p1", "Al", "Batter")])
    games = [{"id": "g1", "pitches": [_pitch("p1", "walk")]}]
    r = stats.compute_batting_stats(games, roster)[0]
    assert r["AB"] == 0
    assert r["AVG"] == 0.0
    assert r["SLG"] == 0.0
    # OBP still defined: 1 time on base / 1 PA
    assert r["OBP"] == 1.0


def test_player_scope_filter():
    roster = [
        {"id": "tm_1", "team_name": "Mine", "my_team": True,
         "roster": [_player("p1", "Al", "Mine")]},
        {"id": "tm_2", "team_name": "Them", "my_team": False,
         "roster": [_player("p2", "Bo", "Opp")]},
    ]
    games = [{"id": "g1", "pitches": [_pitch("p1", "single"), _pitch("p2", "single")]}]

    mine = stats.compute_batting_stats(games, roster, player_ids=["p1"])
    assert len(mine) == 1 and mine[0]["player_id"] == "p1"

    everyone = stats.compute_batting_stats(games, roster)
    assert len(everyone) == 2


def test_game_id_filter():
    roster = _roster([_player("p1", "Al", "Batter")])
    games = [
        {"id": "g1", "pitches": [_pitch("p1", "single")]},
        {"id": "g2", "pitches": [_pitch("p1", "home_run")]},
    ]
    r = stats.compute_batting_stats(games, roster, game_id="g2")[0]
    assert r["HR"] == 1
    assert r["1B"] == 0


def test_null_batter_ignored():
    roster = _roster([_player("p1", "Al", "Batter")])
    games = [{"id": "g1", "pitches": [
        {"batter_id": None, "outcome": "single"},
        _pitch("p1", "single"),
    ]}]
    rows = stats.compute_batting_stats(games, roster)
    assert len(rows) == 1
    assert rows[0]["H"] == 1


def test_woba_uses_weights():
    roster = _roster([_player("p1", "Al", "Batter")])
    games = [{"id": "g1", "pitches": [_pitch("p1", "home_run")]}]
    r = stats.compute_batting_stats(games, roster)[0]
    # Single HR: wOBA = w_hr / (AB) since denom = AB+BB+HBP = 1
    assert r["wOBA"] == round(stats.WOBA_WEIGHTS["home_run"] / 1, 3)
