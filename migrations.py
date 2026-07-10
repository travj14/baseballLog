"""Schema versioning and migration for saved game data.

Saved games predate any formal version field. As the data model grows we need a
disciplined, idempotent way to bring older records up to the current shape
without losing data. `migrate_game` is pure (dict in, dict out) so it can be
unit tested and applied on every load.
"""

# Bump this whenever the on-disk game shape changes, and add a step below.
SCHEMA_VERSION = 2


def _normalize_bases(bases):
    """Legacy games stored base occupancy as booleans; the model now stores a
    runner id (or null). Coerce any boolean into null while keeping real ids."""
    if not isinstance(bases, dict):
        return {"first": None, "second": None, "third": None}
    out = {}
    for key in ("first", "second", "third"):
        val = bases.get(key)
        out[key] = None if isinstance(val, bool) else val
    return out


def _migrate_v1_to_v2(game):
    """v1 (unversioned) -> v2: guarantee required containers exist and drop the
    legacy boolean base-occupancy representation."""
    game.setdefault("home_lineup", [])
    game.setdefault("away_lineup", [])
    game.setdefault("pitches", [])
    game.setdefault("baserunning", [])
    game.setdefault("pitch_counts", {})
    game.setdefault("home_score", 0)
    game.setdefault("away_score", 0)
    game.setdefault("status", "upcoming")

    if isinstance(game.get("state"), dict):
        game["state"]["bases"] = _normalize_bases(game["state"].get("bases"))

    game["version"] = 2
    return game


# Ordered migration steps keyed by the version they upgrade *from*.
_STEPS = {
    1: _migrate_v1_to_v2,
}


def migrate_game(game):
    """Return `game` upgraded to SCHEMA_VERSION. Idempotent: a game already at
    the current version is returned unchanged (aside from being the same dict)."""
    if not isinstance(game, dict):
        return game

    # Unversioned records are treated as version 1.
    version = game.get("version", 1)

    while version < SCHEMA_VERSION:
        step = _STEPS.get(version)
        if step is None:
            # No known path forward; stamp current version to avoid looping.
            game["version"] = SCHEMA_VERSION
            break
        game = step(game)
        version = game.get("version", version + 1)

    return game


def migrate_games(games):
    """Migrate a list of games in place and return it."""
    if not isinstance(games, list):
        return games
    return [migrate_game(g) for g in games]
