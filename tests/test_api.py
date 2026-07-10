"""Integration tests for the Api backend (app.py), driven against a temp data
directory. These exercise the real file read/write paths without launching the
pywebview window.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app
import migrations


@pytest.fixture
def api(tmp_path):
    a = app.Api(str(tmp_path))
    a.create_team("Sluggers", "12U", "Austin")
    # Directory name is derived from name + age group.
    a.select_team("sluggers_12u")
    return a


def _my_team_id(api):
    return api.get_my_team()["id"]


def test_create_team_and_select(api):
    my = api.get_my_team()
    assert my["team_name"] == "Sluggers"
    assert my["my_team"] is True
    assert my["roster"] == []


def test_duplicate_team_rejected(tmp_path):
    a = app.Api(str(tmp_path))
    a.create_team("Sluggers", "12U", "Austin")
    result = a.create_team("Sluggers", "12U", "Austin")
    assert "error" in result


def test_roster_crud(api):
    tid = _my_team_id(api)
    p = api.add_player(tid, "7", "Sammy", "Sosa")
    assert p["first_name"] == "Sammy"
    assert p["id"].startswith("pl_")

    players = api.get_players(tid)
    assert len(players) == 1

    api.remove_player(tid, p["id"])
    assert api.get_players(tid) == []


def test_create_game_creates_opponent(api):
    game = api.create_game("Rivals", "home", "Field 1")
    assert game["status"] == "upcoming"
    assert game["version"] == migrations.SCHEMA_VERSION
    # Opponent auto-created in the roster team list.
    teams = api.get_roster_teams()
    assert any(t["team_name"] == "Rivals" and not t["my_team"] for t in teams)


def test_pitch_recording_and_pitch_count(api):
    api.create_game("Rivals", "home", "Field 1")
    api.pitch({"pitcher_id": "pl_9", "outcome": "strike"})
    api.pitch({"pitcher_id": "pl_9", "outcome": "ball"})
    game = api.pitch({"pitcher_id": "pl_9", "outcome": "single", "batter_id": "pl_1"})
    assert len(game["pitches"]) == 3
    assert game["pitch_counts"]["pl_9"] == 3
    # Pitch ids are assigned sequentially.
    assert [p["id"] for p in game["pitches"]] == ["p_1", "p_2", "p_3"]


def test_undo_last_event_truncates_and_recomputes(api):
    api.create_game("Rivals", "home", "Field 1")
    api.pitch({"pitcher_id": "pl_9", "outcome": "strike"})
    api.pitch({"pitcher_id": "pl_9", "outcome": "ball"})
    api.pitch({"pitcher_id": "pl_9", "outcome": "single", "batter_id": "pl_1"})
    api.record_baserunning({"pitch_id": "p_3", "baserunner_id": "pl_1"})

    # Undo back to 2 pitches, 0 baserunning events.
    game = api.undo_last_event(2, 0)
    assert len(game["pitches"]) == 2
    assert len(game["baserunning"]) == 0
    assert game["pitch_counts"]["pl_9"] == 2
    assert api.pitch_num == 2

    # A subsequent pitch reuses the freed id, not p_4.
    game = api.pitch({"pitcher_id": "pl_9", "outcome": "foul"})
    assert game["pitches"][-1]["id"] == "p_3"


def test_undo_clamps_out_of_range(api):
    api.create_game("Rivals", "home", "Field 1")
    api.pitch({"pitcher_id": "pl_9", "outcome": "strike"})
    game = api.undo_last_event(-5, 99)
    assert len(game["pitches"]) == 0
    assert len(game["baserunning"]) == 0


def test_save_and_reload_persists(api):
    tid = _my_team_id(api)
    api.add_player(tid, "1", "Al", "Batter")
    api.create_game("Rivals", "home", "Field 1")
    api.pitch({"pitcher_id": "pl_9", "outcome": "single", "batter_id": "pl_1"})
    api.save_game()

    # Fresh Api instance reads from disk (and migrates on load).
    a2 = app.Api(api.data_dir)
    a2.select_team("sluggers_12u")
    games = a2.get_games()
    assert len(games) == 1
    assert games[0]["version"] == migrations.SCHEMA_VERSION
    assert len(games[0]["pitches"]) == 1


def test_get_batting_stats_scopes(api):
    tid = _my_team_id(api)
    p = api.add_player(tid, "1", "Al", "Batter")
    api.create_game("Rivals", "home", "Field 1")
    api.pitch({"pitcher_id": "pl_9", "outcome": "single", "batter_id": p["id"]})
    api.pitch({"pitcher_id": "pl_9", "outcome": "out", "batter_id": p["id"]})
    api.save_game()

    rows = api.get_batting_stats()
    assert len(rows) == 1
    assert rows[0]["PA"] == 2
    assert rows[0]["H"] == 1


def test_get_pitch_events_filters(api):
    tid = _my_team_id(api)
    p = api.add_player(tid, "1", "Al", "Batter")
    api.create_game("Rivals", "home", "Field 1")
    api.pitch({"batter_id": p["id"], "outcome": "ball", "zone_x": 0.2, "zone_y": 0.5})
    api.pitch({"batter_id": p["id"], "outcome": "single", "hit_result": "Single",
               "batted_ball_x": 0.7, "batted_ball_y": 0.6})
    # Opponent batter pitch should be excluded under my_team scope.
    api.pitch({"batter_id": "opp_x", "outcome": "strike"})
    api.save_game()

    mine = api.get_pitch_events()
    assert len(mine) == 2
    assert mine[0]["batter_name"] == "Al Batter"

    everyone = api.get_pitch_events(scope="all")
    assert len(everyone) == 3

    only_al = api.get_pitch_events(player_id=p["id"])
    assert all(e["batter_id"] == p["id"] for e in only_al)


def test_export_csv_and_html_write_files(api):
    tid = _my_team_id(api)
    p = api.add_player(tid, "1", "Al", "Batter")
    api.create_game("Rivals", "home", "Field 1")
    api.pitch({"batter_id": p["id"], "outcome": "single", "hit_result": "Single"})
    api.save_game()

    csv_res = api.export_batting_csv()
    assert "path" in csv_res and os.path.exists(csv_res["path"])
    assert csv_res["path"].endswith(".csv")
    with open(csv_res["path"]) as f:
        assert "Al Batter" in f.read()

    html_res = api.export_html_summary()
    assert "path" in html_res and os.path.exists(html_res["path"])
    with open(html_res["path"]) as f:
        body = f.read()
    assert "<!DOCTYPE html>" in body
    assert "Sluggers" in body


def test_error_paths_without_selection(tmp_path):
    a = app.Api(str(tmp_path))
    assert "error" in a.get_batting_stats()
    assert "error" in a.get_roster_teams()
    assert "error" in a.undo_last_event(0, 0)
    assert "error" in a.get_pitch_events()
    assert "error" in a.export_batting_csv()
    assert "error" in a.export_html_summary()
