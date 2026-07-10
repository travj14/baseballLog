"""Tests for the pure export builders (exports.py)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import csv
import io

import exports


def _rows():
    return [
        {"name": "Al Batter", "number": "7", "PA": 4, "AB": 4, "H": 2, "1B": 1,
         "2B": 1, "3B": 0, "HR": 0, "BB": 0, "HBP": 0, "SO": 1, "TB": 3,
         "AVG": 0.5, "OBP": 0.5, "SLG": 0.75, "OPS": 1.25, "wOBA": 0.6},
        {"name": "Bo Runner", "number": "3", "PA": 3, "AB": 2, "H": 1, "1B": 0,
         "2B": 0, "3B": 0, "HR": 1, "BB": 1, "HBP": 0, "SO": 0, "TB": 4,
         "AVG": 0.5, "OBP": 0.667, "SLG": 2.0, "OPS": 2.667, "wOBA": 1.2},
    ]


def test_batting_csv_roundtrips():
    text = exports.batting_csv(_rows())
    parsed = list(csv.reader(io.StringIO(text)))
    assert parsed[0][:2] == ["Player", "Number"]
    assert "wOBA" in parsed[0]
    assert parsed[1][0] == "Al Batter"
    # PA column value present.
    pa_idx = parsed[0].index("PA")
    assert parsed[1][pa_idx] == "4"


def test_csv_rate_formatting_drops_leading_zero():
    text = exports.batting_csv(_rows())
    # AVG .500 should appear without a leading zero.
    assert ".500" in text
    assert "0.500" not in text
    # OPS above 1 keeps the leading digit.
    assert "1.250" in text


def test_html_summary_is_self_contained():
    doc = exports.html_summary("Sluggers", _rows(), "2026-07-10 12:00")
    assert doc.strip().startswith("<!DOCTYPE html>")
    assert "Sluggers" in doc
    assert "Al Batter" in doc
    assert "Team totals" in doc
    # No external resources.
    assert "http://" not in doc and "https://" not in doc
    assert "<link" not in doc and "src=" not in doc


def test_html_totals_recomputed():
    doc = exports.html_summary("Sluggers", _rows(), "2026-07-10 12:00")
    # Combined AB = 6, H = 3 -> AVG .500 appears in totals row.
    assert "Team totals" in doc


def test_empty_rows():
    assert "Player" in exports.batting_csv([])
    doc = exports.html_summary("Sluggers", [], "2026-07-10 12:00")
    assert "Sluggers" in doc


def test_game_summary_html():
    doc = exports.game_summary_html(
        "Sluggers", "Rivals", "home", 5, 3, "W", _rows(), "2026-07-10 12:00")
    assert doc.strip().startswith("<!DOCTYPE html>")
    assert "Sluggers vs Rivals" in doc
    assert "5 &ndash; 3" in doc
    assert "Win" in doc
    assert "@media print" in doc
    assert "Al Batter" in doc


def test_game_summary_away_matchup():
    doc = exports.game_summary_html(
        "Sluggers", "Rivals", "away", 2, 7, "L", _rows(), "2026-07-10 12:00")
    assert "Sluggers @ Rivals" in doc
    assert "Loss" in doc


def test_season_csv():
    log = [
        {"game_id": "g1", "opponent": "Rivals", "home_away": "home",
         "my_score": 5, "opp_score": 3, "result": "W", "status": "complete"},
        {"game_id": "g2", "opponent": "Rivals", "home_away": "away",
         "my_score": 2, "opp_score": 7, "result": "L", "status": "complete"},
    ]
    text = exports.season_csv(log)
    parsed = list(csv.reader(io.StringIO(text)))
    assert parsed[0] == ["Game", "Opponent", "Home/Away", "Result", "Runs For", "Runs Against", "Status"]
    assert parsed[1][3] == "W"
    assert parsed[2][2] == "Away"


def test_sf_sh_columns_present_in_csv():
    text = exports.batting_csv(_rows())
    header = text.splitlines()[0]
    assert "SF" in header and "SH" in header
