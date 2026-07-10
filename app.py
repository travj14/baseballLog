import os
import sys
import json
import webview

import stats
import migrations
import exports
import datetime


class Api:
    """Bridge between the HTML frontend and local filesystem."""

    def __init__(self, data_dir):
        self.data_dir = data_dir
        self.current_team = None
        self.current_game = None
        self.pitch_num = 0

    # --- Team methods ---

    def get_teams(self):
        teams_path = os.path.join(self.data_dir, "teams.json")
        if not os.path.exists(teams_path):
            return []
        with open(teams_path, "r") as f:
            return json.load(f)

    def create_team(self, team_name, age_group, location):
        teams_path = os.path.join(self.data_dir, "teams.json")
        if os.path.exists(teams_path):
            with open(teams_path, "r") as f:
                teams = json.load(f)
        else:
            teams = []

        team_dir_name = (
            team_name.strip().replace(" ", "_").lower()
            + "_"
            + age_group.strip().replace(" ", "_").lower()
        )

        for t in teams:
            if t["directory"] == team_dir_name:
                return {"error": "A team with this name and age group already exists."}

        team_dir = os.path.join(self.data_dir, team_dir_name)
        os.makedirs(team_dir, exist_ok=True)

        team = {
            "name": team_name,
            "age_group": age_group,
            "location": location,
            "directory": team_dir_name,
        }
        teams.append(team)

        with open(teams_path, "w") as f:
            json.dump(teams, f, indent=2)

        roster_path = os.path.join(team_dir, "teams.json")
        my_team_entry = {
            "id": "tm_1",
            "team_name": team_name,
            "location": location,
            "my_team": True,
            "roster": [],
        }
        with open(roster_path, "w") as f:
            json.dump([my_team_entry], f, indent=2)

        return team

    def select_team(self, team_directory):
        self.current_team = team_directory
        self.current_game = None
        return True

    # --- Roster methods ---

    def _get_roster_path(self):
        return os.path.join(self.data_dir, self.current_team, "teams.json")

    def _load_roster(self):
        path = self._get_roster_path()
        if not os.path.exists(path):
            return []
        with open(path, "r") as f:
            return json.load(f)

    def _save_roster(self, teams):
        path = self._get_roster_path()
        with open(path, "w") as f:
            json.dump(teams, f, indent=2)

    def _next_player_id(self, teams):
        max_id = 0
        for team in teams:
            for player in team.get("roster", []):
                num = int(player["id"].split("_")[1])
                if num > max_id:
                    max_id = num
        return f"pl_{max_id + 1}"

    def add_team_to_roster(self, team_name, location):
        if not self.current_team:
            return {"error": "No team selected."}

        teams = self._load_roster()

        if teams:
            max_id = max(int(t["id"].split("_")[1]) for t in teams)
        else:
            max_id = 0
        team_id = f"tm_{max_id + 1}"

        for t in teams:
            if t["team_name"].lower() == team_name.strip().lower():
                return {"error": "Team already exists in roster."}

        team = {
            "id": team_id,
            "team_name": team_name,
            "location": location,
            "my_team": False,
            "roster": [],
        }
        teams.append(team)
        self._save_roster(teams)
        return team

    def get_roster_teams(self):
        if not self.current_team:
            return {"error": "No team selected."}
        return self._load_roster()

    def get_my_team(self):
        if not self.current_team:
            return {"error": "No team selected."}
        teams = self._load_roster()
        for team in teams:
            if team.get("my_team"):
                return team
        return {"error": "No team flagged as my_team."}

    def add_player(self, team_id, number, first_name, last_name):
        if not self.current_team:
            return {"error": "No team selected."}

        teams = self._load_roster()
        player_id = self._next_player_id(teams)

        for team in teams:
            if team["id"] == team_id:
                player = {
                    "id": player_id,
                    "number": number,
                    "first_name": first_name,
                    "last_name": last_name,
                }
                team["roster"].append(player)
                self._save_roster(teams)
                return player

        return {"error": "Team not found."}

    def remove_player(self, team_id, player_id):
        if not self.current_team:
            return {"error": "No team selected."}

        teams = self._load_roster()
        for team in teams:
            if team["id"] == team_id:
                team["roster"] = [p for p in team["roster"] if p["id"] != player_id]
                self._save_roster(teams)
                return True

        return {"error": "Team not found."}

    def get_players(self, team_id):
        if not self.current_team:
            return {"error": "No team selected."}

        teams = self._load_roster()
        for team in teams:
            if team["id"] == team_id:
                return team["roster"]

        return {"error": "Team not found."}

    # --- Game methods ---

    def _get_games_path(self):
        return os.path.join(self.data_dir, self.current_team, "games.json")

    def _load_games(self):
        path = self._get_games_path()
        if not os.path.exists(path):
            return []
        with open(path, "r") as f:
            games = json.load(f)
        return migrations.migrate_games(games)

    def _save_games(self, games):
        path = self._get_games_path()
        with open(path, "w") as f:
            json.dump(games, f, indent=2)

    def get_games(self):
        if not self.current_team:
            return {"error": "No team selected."}
        return self._load_games()

    def create_game(self, opponent_name, home_away, location):
        if not self.current_team:
            return {"error": "No team selected."}

        # Find or create opponent in roster
        teams = self._load_roster()
        opponent_id = None
        for t in teams:
            if t["team_name"].lower() == opponent_name.strip().lower() and not t.get("my_team"):
                opponent_id = t["id"]
                break

        if not opponent_id:
            result = self.add_team_to_roster(opponent_name.strip(), "")
            if isinstance(result, dict) and "error" in result:
                return result
            opponent_id = result["id"]

        games = self._load_games()

        if games:
            max_id = max(int(g["id"].split("_")[1]) for g in games)
        else:
            max_id = 0
        game_id = f"game_{max_id + 1}"
        self.pitch_num = 0
        self.current_game = {
            "id": game_id,
            "version": migrations.SCHEMA_VERSION,
            "opponent_id": opponent_id,
            "home_away": home_away,
            "location": location,
            "status": "upcoming",
            "home_score": 0,
            "away_score": 0,
            "home_lineup": [],
            "away_lineup": [],
            "pitches": [],
            "baserunning": [],
            "pitch_counts": {},
        }

        games.append(self.current_game)
        self._save_games(games)
        return self.current_game

    def continue_game(self, game_id):
        if not self.current_team:
            return {"error": "No team selected."}

        games = self._load_games()
        for game in games:
            if game["id"] == game_id:
                if game["status"] == "complete":
                    return {"error": "Game is already complete."}
                self.current_game = game
                self.pitch_num = len(game["pitches"])
                return self.current_game

        return {"error": "Game not found."}

    def set_lineup(self, side, player_ids):
        if not self.current_game:
            return {"error": "No active game."}
        if side not in ("home", "away"):
            return {"error": "Side must be 'home' or 'away'."}
        self.current_game[f"{side}_lineup"] = player_ids
        return self.current_game

    def pitch(self, pitch_data):
        if not self.current_game:
            return {"error": "No active game."}

        self.pitch_num += 1
        pitch_id = f"p_{self.pitch_num}"
        pitch_data["id"] = pitch_id
        self.current_game["pitches"].append(pitch_data)

        # Update pitcher pitch count
        if "pitch_counts" not in self.current_game:
            self.current_game["pitch_counts"] = {}
        pitcher_id = pitch_data.get("pitcher_id")
        if pitcher_id:
            self.current_game["pitch_counts"][pitcher_id] = \
                self.current_game["pitch_counts"].get(pitcher_id, 0) + 1

        if "home_score" in pitch_data:
            self.current_game["home_score"] = pitch_data["home_score"]
        if "away_score" in pitch_data:
            self.current_game["away_score"] = pitch_data["away_score"]

        return self.current_game

    def record_baserunning(self, entry):
        if not self.current_game:
            return {"error": "No active game."}
        if "baserunning" not in self.current_game:
            self.current_game["baserunning"] = []
        self.current_game["baserunning"].append(entry)
        return self.current_game

    def undo_last_event(self, pitches_len, baserunning_len):
        """Truncate the pitch and baserunning event logs back to the given
        lengths and recompute pitch counts from what remains.

        The frontend owns live game state (count/outs/bases/score) and restores
        it from its own undo snapshot; this keeps the persisted event history in
        sync with that restore.
        """
        if not self.current_game:
            return {"error": "No active game."}

        pitches = self.current_game.get("pitches", [])
        baserunning = self.current_game.get("baserunning", [])

        pitches_len = max(0, min(pitches_len, len(pitches)))
        baserunning_len = max(0, min(baserunning_len, len(baserunning)))

        self.current_game["pitches"] = pitches[:pitches_len]
        self.current_game["baserunning"] = baserunning[:baserunning_len]
        self.pitch_num = pitches_len

        # Recompute pitch counts from the surviving pitches so they never drift.
        counts = {}
        for p in self.current_game["pitches"]:
            pid = p.get("pitcher_id")
            if pid:
                counts[pid] = counts.get(pid, 0) + 1
        self.current_game["pitch_counts"] = counts

        return self.current_game

    def update_game_state(self, state):
        if not self.current_game:
            return {"error": "No active game."}
        self.current_game["state"] = state
        return self.current_game

    def update_score(self, home_score, away_score):
        if not self.current_game:
            return {"error": "No active game."}
        self.current_game["home_score"] = home_score
        self.current_game["away_score"] = away_score
        return self.current_game

    def save_game(self):
        if not self.current_team:
            return {"error": "No team selected."}
        if not self.current_game:
            return {"error": "No active game."}

        games = self._load_games()
        for i, game in enumerate(games):
            if game["id"] == self.current_game["id"]:
                games[i] = self.current_game
                self._save_games(games)
                return self.current_game

        return {"error": "Game not found in file."}

    # --- Analysis methods ---

    def get_batting_stats(self, game_id=None, scope="my_team"):
        """Return aggregated batting stat lines.

        game_id: limit to a single game, or None for all games.
        scope:   "my_team" (default) restricts to the user's own roster,
                 "all" includes every batter found (my team and opponents).
        """
        if not self.current_team:
            return {"error": "No team selected."}

        roster_teams = self._load_roster()
        games = self._load_games()

        player_ids = None
        if scope == "my_team":
            player_ids = [
                p["id"]
                for team in roster_teams
                if team.get("my_team")
                for p in team.get("roster", [])
            ]

        return stats.compute_batting_stats(
            games, roster_teams, game_id=game_id, player_ids=player_ids
        )

    def _my_team_player_ids(self, roster_teams):
        return [
            p["id"]
            for team in roster_teams
            if team.get("my_team")
            for p in team.get("roster", [])
        ]

    def get_pitch_events(self, game_id=None, scope="my_team", player_id=None):
        """Return per-pitch events for charting (pitch-location and spray maps).

        Only pitches that carry normalized coordinates are useful to plot, but
        all matching pitches are returned so the frontend can report coverage.
        """
        if not self.current_team:
            return {"error": "No team selected."}

        roster_teams = self._load_roster()
        games = self._load_games()

        name_map = {}
        for team in roster_teams:
            for p in team.get("roster", []):
                name_map[p["id"]] = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()

        allowed = None
        if scope == "my_team":
            allowed = set(self._my_team_player_ids(roster_teams))

        events = []
        for game in games:
            if game_id is not None and game.get("id") != game_id:
                continue
            for pitch in game.get("pitches", []):
                batter_id = pitch.get("batter_id")
                if allowed is not None and batter_id not in allowed:
                    continue
                if player_id and batter_id != player_id:
                    continue
                events.append({
                    "batter_id": batter_id,
                    "batter_name": name_map.get(batter_id, batter_id or ""),
                    "outcome": pitch.get("outcome"),
                    "hit_result": pitch.get("hit_result"),
                    "hit_type": pitch.get("hit_type"),
                    "in_zone": pitch.get("in_zone"),
                    "zone_x": pitch.get("zone_x"),
                    "zone_y": pitch.get("zone_y"),
                    "batted_ball_x": pitch.get("batted_ball_x"),
                    "batted_ball_y": pitch.get("batted_ball_y"),
                    "inning": pitch.get("inning"),
                    "half": pitch.get("half"),
                })
        return events

    def _resolve_ids(self, scope, player_id, roster_teams):
        if player_id:
            return [player_id]
        if scope == "my_team":
            return self._my_team_player_ids(roster_teams)
        return None

    def get_splits(self, dimension, game_id=None, scope="my_team", player_id=None):
        if not self.current_team:
            return {"error": "No team selected."}
        roster_teams = self._load_roster()
        ids = self._resolve_ids(scope, player_id, roster_teams)
        return stats.compute_splits(
            self._load_games(), roster_teams, dimension, player_ids=ids, game_id=game_id)

    def get_pitching_stats(self, game_id=None, scope="my_team", player_id=None):
        if not self.current_team:
            return {"error": "No team selected."}
        roster_teams = self._load_roster()
        ids = self._resolve_ids(scope, player_id, roster_teams)
        return stats.compute_pitching_stats(
            self._load_games(), roster_teams, pitcher_ids=ids, game_id=game_id)

    def get_baserunning_stats(self, game_id=None, scope="my_team", player_id=None):
        if not self.current_team:
            return {"error": "No team selected."}
        roster_teams = self._load_roster()
        ids = self._resolve_ids(scope, player_id, roster_teams)
        return stats.compute_baserunning_stats(
            self._load_games(), roster_teams, player_ids=ids, game_id=game_id)

    def get_fielding_stats(self, game_id=None, scope="my_team", player_id=None):
        if not self.current_team:
            return {"error": "No team selected."}
        roster_teams = self._load_roster()
        ids = self._resolve_ids(scope, player_id, roster_teams)
        return stats.compute_fielding_stats(
            self._load_games(), roster_teams, player_ids=ids, game_id=game_id)

    def record_substitution(self, entry):
        if not self.current_game:
            return {"error": "No active game."}
        self.current_game.setdefault("substitutions", []).append(entry)
        return self.current_game

    def get_game_log(self):
        if not self.current_team:
            return {"error": "No team selected."}
        return stats.compute_game_log(self._load_games(), self._load_roster())

    def get_season_summary(self):
        if not self.current_team:
            return {"error": "No team selected."}
        game_log = stats.compute_game_log(self._load_games(), self._load_roster())
        return {
            "record": stats.compute_season_record(game_log),
            "games": game_log,
        }

    # --- Export methods ---

    def _exports_dir(self):
        path = os.path.join(self.data_dir, self.current_team, "exports")
        os.makedirs(path, exist_ok=True)
        return path

    def _my_team_name(self, roster_teams):
        for team in roster_teams:
            if team.get("my_team"):
                return team.get("team_name", "Team")
        return "Team"

    def export_batting_csv(self, game_id=None, scope="my_team"):
        if not self.current_team:
            return {"error": "No team selected."}
        rows = self.get_batting_stats(game_id=game_id, scope=scope)
        if isinstance(rows, dict) and "error" in rows:
            return rows

        content = exports.batting_csv(rows)
        stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        path = os.path.join(self._exports_dir(), f"batting_{stamp}.csv")
        with open(path, "w", newline="") as f:
            f.write(content)
        return {"path": path}

    def export_html_summary(self, game_id=None, scope="my_team"):
        if not self.current_team:
            return {"error": "No team selected."}
        roster_teams = self._load_roster()
        rows = self.get_batting_stats(game_id=game_id, scope=scope)
        if isinstance(rows, dict) and "error" in rows:
            return rows

        scope_label = "All games" if not game_id else f"Game {game_id}"
        content = exports.html_summary(
            self._my_team_name(roster_teams),
            rows,
            datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
            scope_label=scope_label,
        )
        stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        path = os.path.join(self._exports_dir(), f"batting_summary_{stamp}.html")
        with open(path, "w") as f:
            f.write(content)
        return {"path": path}

    def export_game_summary(self, game_id):
        if not self.current_team:
            return {"error": "No team selected."}
        if not game_id:
            return {"error": "Select a game first."}

        roster_teams = self._load_roster()
        game_log = stats.compute_game_log(self._load_games(), roster_teams)
        meta = next((g for g in game_log if g["game_id"] == game_id), None)
        if not meta:
            return {"error": "Game not found."}

        rows = self.get_batting_stats(game_id=game_id, scope="my_team")
        content = exports.game_summary_html(
            self._my_team_name(roster_teams),
            meta["opponent"],
            meta["home_away"],
            meta["my_score"],
            meta["opp_score"],
            meta["result"],
            rows,
            datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        )
        stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        path = os.path.join(self._exports_dir(), f"game_{game_id}_summary_{stamp}.html")
        with open(path, "w") as f:
            f.write(content)
        return {"path": path}

    def export_season_csv(self):
        if not self.current_team:
            return {"error": "No team selected."}
        game_log = stats.compute_game_log(self._load_games(), self._load_roster())
        content = exports.season_csv(game_log)
        stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        path = os.path.join(self._exports_dir(), f"season_{stamp}.csv")
        with open(path, "w", newline="") as f:
            f.write(content)
        return {"path": path}

    def end_game(self):
        if not self.current_game:
            return {"error": "No active game."}

        self.current_game["status"] = "complete"
        result = self.save_game()
        self.current_game = None
        return result


def get_resource_dir():
    if getattr(sys, "_MEIPASS", None):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


def get_data_dir():
    if getattr(sys, "frozen", False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base, "data")
    os.makedirs(data_dir, exist_ok=True)
    return data_dir


if __name__ == "__main__":
    data_dir = get_data_dir()
    api = Api(data_dir)
    html_path = os.path.join(get_resource_dir(), "ui", "index.html")
    window = webview.create_window(
        "Baseball Log",
        html_path,
        js_api=api,
        width=1024,
        height=768,
    )
    webview.start()
