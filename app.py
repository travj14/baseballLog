import os
import sys
import json
import webview


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
            return json.load(f)

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
