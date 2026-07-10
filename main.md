# Baseball Log

## What This App Is

Baseball Log is a local desktop app for scoring and tracking baseball games pitch by pitch. The long-term goal is to put modern baseball analytics inside a usable scorebook.

The app is intended for scorekeepers, analysts, coaches, parents, and anyone who wants to better understand a team or player. It should work for casual users, but it is especially aimed at analytically minded users who want searchable, split-heavy, zone-specific, player-specific baseball data.

The primary use case is youth baseball, but the app should be flexible enough to support higher levels of play. Official baseball scoring accuracy is the ideal target, even if early versions need to prioritize the highest-value scoring workflows first.

The app is designed around a team-first workflow:

1. Create or select a team.
2. Manage that team's roster.
3. Create games against opponents.
4. Enter a live game scoring screen.
5. Set home and away lineups.
6. Record pitches, outcomes, hits, baserunning, outs, innings, score, and pitch counts.
7. Save or finish the game.
8. Eventually review team and player analysis from the collected game data.

The current app is focused on manual game logging. It gives the scorer a visual baseball-field interface with a strike zone, score bug, lineup panels, base runner controls, and pitch outcome menus.

The larger product direction is an analytics-first scorebook: capture enough structured detail during scoring that nearly anything in the data can be queried later.

## Current User Workflow

### Home Screen

The home screen lets the user select an existing team or create a new one. Teams are stored locally in JSON and each team gets its own data directory.

### Team Dashboard

After opening a team, the dashboard shows:

- The selected team's roster.
- Active and upcoming games.
- Finished games.
- Buttons to add players, create games, and open the analysis screen.

The analysis screen currently exists as a placeholder. The first useful version should show batter stats such as AVG, OBP, SLG, wOBA, PA, HR, and related basic batting summaries. Longer term, it should become a Baseball Savant-style search and analysis surface for locally scored games.

### Game Setup

When a game is created, the user chooses:

- Opponent.
- Home or away.
- Location.

If the opponent does not already exist in the local roster/team list, the app creates an opponent team record automatically.

### Game Scoring

Inside a game, the scorer can:

- Drag players into home and away lineups.
- Assign defensive positions.
- Add missing players during the game.
- Confirm lineups.
- Track the current batter and pitcher.
- Track inning, half inning, balls, strikes, outs, base runners, and score.
- Click a pitch location on the field/strike-zone area.
- Mark pitch outcomes such as ball, strike, foul, foul tip, HBP, hit, or out.
- Record hit details such as single, double, triple, home run, error, and batted-ball type.
- Resolve runner advancement after balls in play.
- Drag existing runners between bases to record steals, wild pitches, passed balls, previous-play advancement, caught stealing, pickoffs, and outs.
- Save manually or use autosave.
- End the game, which marks it complete.

## Infrastructure

This is a small local desktop application, not a hosted web app.

### Backend

The backend is [app.py](app.py). It uses Python and `pywebview` to expose a JavaScript API to the frontend.

The Python side is responsible for:

- Creating and selecting teams.
- Reading and writing roster data.
- Creating and continuing games.
- Saving lineups.
- Recording pitches.
- Recording baserunning events.
- Updating game state and score.
- Ending games.
- Locating the correct local data directory in development or packaged mode.

There is no separate web server, database server, or API service. The app runs locally and writes directly to JSON files.

### Frontend

The frontend lives in the [ui](ui) directory:

- [ui/index.html](ui/index.html): app screens, modals, score bug, lineups, strike zone, and game controls.
- [ui/app.js](ui/app.js): frontend state, event handling, scoring logic, pywebview API calls, game-state updates, and interaction behavior.
- [ui/style.css](ui/style.css): dashboard layout, game screen, score bug, lineups, pitch menus, base runner UI, and visual styling.
- [ui/diamond.webp](ui/diamond.webp): baseball field background asset.

The frontend calls Python through `window.pywebview.api`.

### Data Storage

Data is stored locally under [data](data).

At the top level:

- `data/teams.json` stores the list of created teams.

Inside each team directory:

- `teams.json` stores the user's team, opponent teams, and rosters.
- `games.json` stores games, lineups, pitches, baserunning events, scores, and saved game state.

The current local data includes a Brewers MLB team with Pirates and Reds opponent records. The existing game data appears to be development/test data rather than clean real-game data.

### Packaging

The app can be packaged as a macOS desktop app with PyInstaller.

Relevant files:

- [requirements.txt](requirements.txt): Python dependencies.
- [baseballlog.spec](baseballlog.spec): PyInstaller build configuration.
- [build.sh](build.sh): installs dependencies, builds the app, and copies `BaseballLog.app` to the Desktop.

Build outputs are currently present under:

- `build/`
- `dist/`

## Current State

The app already supports the core manual scoring loop:

- Teams and rosters.
- Opponent creation.
- Game creation.
- Game continuation.
- Lineup management.
- Pitch-by-pitch logging.
- Count, outs, innings, bases, score, and pitch count tracking.
- Baserunning events.
- Manual save, autosave, unsaved-change handling, and end-game flow.

There are uncommitted local changes in the main app files, so the working tree appears to contain active development work.

## Plan Going Forward

### 1. Product Goal

Baseball Log should become an analytics-first scorebook.

The app should serve scorekeepers and analysts first, while staying approachable enough for coaches, parents, and team staff who are not deeply technical. It should be useful for youth baseball by default, but not boxed into youth-only rules or data.

The goal is not just to log a game. The goal is to collect structured baseball events that can power analysis later:

- Traditional batting, pitching, fielding, and baserunning stats.
- Split stats by player, team, game, season, count, inning, opponent, handedness, pitch type, zone, and situation.
- Zone-specific hitting and pitching results.
- Pitch-location maps.
- Spray charts and batted-ball maps.
- Fielding and defensive performance views.
- Baserunning value and mistake tracking.
- Multi-game and season summaries.
- Searchable, filterable event history similar in spirit to Baseball Savant's search experience.

### 2. Stabilize The Scoring Model

The app should define a clear internal model for:

- Plate appearances.
- Pitches.
- Pitch type.
- Pitch location.
- Pitch result.
- At-bat outcomes.
- Reached-on-error cases.
- Sacrifice plays.
- Fielder's choice.
- Batted-ball type and location.
- Stolen bases.
- Pickoffs.
- Passed balls and wild pitches.
- Courtesy runners.
- Pitch limits.
- Substitutions.
- Defensive position changes.
- Runs and earned/unearned run attribution.
- Pitcher responsibility for runners.
- Fielding chances and errors.
- Opponent roster detail.

Right now, the app captures useful raw events, but the data model should be tightened before building serious analysis on top of it. Because official baseball scoring is the ideal, the event model should preserve enough detail to calculate official-style stats and more advanced custom stats.

Opponent rosters matter. The app should let the user score an opponent with the same level of detail as their own team when desired, while still allowing vague placeholder opponent players when the scorer does not know the full roster.

### 3. Improve Saved Data Consistency

The current JSON format works for local development, but we should make the saved data more consistent before the app grows.

Potential improvements:

- Add a formal version field to saved data.
- Normalize player IDs and runner IDs.
- Avoid legacy values like boolean base occupancy or placeholder runner values.
- Separate live game state from event history.
- Add migration logic for older saved games.
- Store enough structured detail to support official scoring and advanced querying.
- Track both the raw scored event and the derived stat consequences.

### 4. Build The Analysis Screen

The analysis screen is the natural next major feature. The first version should focus on batter stats from existing local games.

Initial batter stats:

- PA.
- AB.
- H.
- 1B, 2B, 3B, HR.
- BB.
- HBP.
- SO.
- AVG.
- OBP.
- SLG.
- OPS.
- wOBA, once weights are defined.

After that, the analysis screen should expand toward a Baseball Savant-style search page for the user's own local data.

Target analysis capabilities:

- Filter by player, team, game, season, opponent, date range, inning, count, base/out state, score state, and lineup spot.
- Filter by pitch type, pitch location, pitch result, batted-ball result, batted-ball type, and batted-ball location.
- Show splits for hitters, pitchers, fielders, baserunners, teams, and opponents.
- Show zone-specific hitting and pitching stats.
- Show pitch maps, heat maps, and batted-ball/spray maps.
- Show fielding stats and defensive opportunity tracking.
- Show baserunning stats, steals, caught stealing, pickoffs, extra-base advancement, outs on bases, wild pitch and passed ball advancement, and scoring from each base state.
- Support multi-game and season summaries.
- Make any captured field queryable wherever practical.

### 5. Add Validation And Guardrails

The scoring UI should prevent or clearly handle impossible states.

Examples:

- Recording pitches without a confirmed lineup.
- Recording a pitch without a pitcher.
- Advancing a runner onto an occupied base.
- Ending an at-bat without a batter.
- Creating duplicate players or teams.
- Continuing a game with corrupted or old-format state.
- Applying runner movement that conflicts with occupied bases.
- Recording official scoring outcomes without required details.
- Losing track of substitutions, position changes, or pitcher responsibility.

The app should also support undoing the last pitch. Editing older events would be useful later, but undo-last-pitch is the first required mistake-correction workflow.

### 6. Data And Infrastructure Direction

Stats should stay local for now. Cloud sync, sharing, or a server-backed version may be useful later, but that is too much infrastructure for the current scale.

JSON is simple and good for early local development. If the app becomes larger, we may eventually want SQLite.

SQLite would help with:

- Querying analysis data.
- Avoiding full-file rewrites.
- Managing schema migrations.
- Reducing risk of data corruption.
- Supporting larger histories.

For now, JSON is acceptable as long as we keep the data model disciplined.

Export will matter. The app should eventually support:

- CSV exports for raw data and stat tables.
- PDF summaries for sharing.
- HTML summaries for browser-friendly reports.
- Scorebook-style game summaries.

### 7. Testing And Reliability

The app currently does not appear to have automated tests.

Useful next tests would cover:

- Team creation.
- Roster CRUD.
- Game creation.
- Pitch recording.
- Count and inning transitions.
- Runner advancement.
- Save and reload behavior.
- Data migration behavior once schemas are versioned.
- Undo-last-pitch behavior.
- Official scoring edge cases.
- Analysis stat calculations.

### 8. Distribution

The app is desktop/laptop-first. It does not need mobile or tablet support right now.

The current distribution path is a personal local app built with PyInstaller, but it should remain easy to package and share with other users if desired.

## Remaining Questions

These questions still need product decisions before the app gets much larger.

1. Which youth baseball rule sets should be supported first?
2. Should the app support softball-specific rules, or stay baseball-only for now?
3. What exact wOBA weights should be used: MLB-style defaults, configurable weights, or youth-specific approximations?
4. How should pitch types be entered during live scoring without slowing the scorer down?
5. How should batted-ball location be captured: simple spray zones, clickable field map, coordinates, or both?
6. How detailed should fielding data be in the first version: errors only, all chances, or full play responsibility?
7. Should the first analysis screen be team-wide by default, player table by default, or a searchable/filterable report builder?
8. What is the minimum official scoring feature set needed before analysis stats can be trusted?
