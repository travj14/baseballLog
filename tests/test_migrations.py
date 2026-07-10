"""Tests for schema versioning and migration (migrations.py)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import migrations


def test_unversioned_game_upgraded_to_current():
    game = {"id": "g1"}
    out = migrations.migrate_game(game)
    assert out["version"] == migrations.SCHEMA_VERSION
    # Required containers are created.
    for key in ("pitches", "baserunning", "pitch_counts", "home_lineup", "away_lineup"):
        assert key in out


def test_boolean_bases_normalized_to_null():
    game = {
        "id": "g1",
        "state": {"bases": {"first": True, "second": False, "third": "pl_3"}},
    }
    out = migrations.migrate_game(game)
    assert out["state"]["bases"]["first"] is None
    assert out["state"]["bases"]["second"] is None
    assert out["state"]["bases"]["third"] == "pl_3"


def test_migration_is_idempotent():
    game = {"id": "g1", "state": {"bases": {"first": True}}}
    once = migrations.migrate_game(dict(game))
    twice = migrations.migrate_game(dict(once))
    assert once == twice
    assert twice["version"] == migrations.SCHEMA_VERSION


def test_current_version_unchanged():
    game = {
        "id": "g1",
        "version": migrations.SCHEMA_VERSION,
        "pitches": [{"outcome": "single"}],
        "baserunning": [],
        "pitch_counts": {},
        "home_lineup": [],
        "away_lineup": [],
    }
    out = migrations.migrate_game(dict(game))
    assert out == game


def test_migrate_games_list():
    games = [{"id": "g1"}, {"id": "g2", "version": migrations.SCHEMA_VERSION}]
    out = migrations.migrate_games(games)
    assert all(g["version"] == migrations.SCHEMA_VERSION for g in out)


def test_existing_scores_preserved():
    game = {"id": "g1", "home_score": 5, "away_score": 3}
    out = migrations.migrate_game(game)
    assert out["home_score"] == 5
    assert out["away_score"] == 3
