const homeScreen = document.getElementById("home");
const createScreen = document.getElementById("create-team");
const dashboardScreen = document.getElementById("team-dashboard");
const teamSelect = document.getElementById("team-select");
const openTeamBtn = document.getElementById("open-team-btn");
const showCreateBtn = document.getElementById("show-create-btn");
const cancelCreateBtn = document.getElementById("cancel-create-btn");
const createForm = document.getElementById("create-team-form");
const createError = document.getElementById("create-error");
const backHomeBtn = document.getElementById("back-home-btn");
const dashboardTitle = document.getElementById("dashboard-title");
const rosterList = document.getElementById("roster-list");
const gamesActive = document.getElementById("games-active");
const gamesFinished = document.getElementById("games-finished");
const noActive = document.getElementById("no-active");
const noFinished = document.getElementById("no-finished");
const createGameBtn = document.getElementById("create-game-btn");
const addPlayerBtn = document.getElementById("add-player-btn");

// Modals
const addPlayerModal = document.getElementById("add-player-modal");
const addPlayerForm = document.getElementById("add-player-form");
const cancelPlayerBtn = document.getElementById("cancel-player-btn");
const playerError = document.getElementById("player-error");
const createGameModal = document.getElementById("create-game-modal");
const createGameForm = document.getElementById("create-game-form");
const cancelGameBtn = document.getElementById("cancel-game-btn");
const gameError = document.getElementById("game-error");

let selectedGame = null;

function showScreen(screen) {
    document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
    screen.classList.remove("hidden");
}

function statusClass(status) {
    if (status === "upcoming") return "status-upcoming";
    if (status === "in-progress") return "status-in-progress";
    if (status === "complete") return "status-complete";
    return "";
}

function addGameCard(game) {
    const prefix = game.home_away === "away" ? "@ " : "";
    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
        <div class="opponent">${prefix}${game.opponent}</div>
        <div class="score-row">
            <span class="score">${game.home_score} - ${game.away_score}</span>
            <span class="status ${statusClass(game.status)}">${game.status}</span>
        </div>
    `;

    if (game.status === "complete") {
        gamesFinished.appendChild(card);
        noFinished.classList.add("hidden");
    } else {
        card.classList.add("game-card-clickable");
        card.addEventListener("click", async () => {
            const result = await window.pywebview.api.continue_game(game.id);
            if (result.error) return;
            selectedGame = game;
            document.getElementById("enter-game-title").textContent =
                `${prefix}${game.opponent} (${game.home_score} - ${game.away_score})`;
            document.getElementById("enter-game-id").value = game.id;
            document.getElementById("enter-game-modal").classList.remove("hidden");
        });
        gamesActive.appendChild(card);
        noActive.classList.add("hidden");
    }
}

async function loadTeams() {
    const teams = await window.pywebview.api.get_teams();
    teamSelect.innerHTML = "";

    if (teams.length === 0) {
        teamSelect.innerHTML = '<option value="">-- No teams yet --</option>';
        openTeamBtn.disabled = true;
        return;
    }

    teams.forEach(team => {
        const opt = document.createElement("option");
        opt.value = team.directory;
        opt.textContent = `${team.name} (${team.age_group}) - ${team.location}`;
        teamSelect.appendChild(opt);
    });
    openTeamBtn.disabled = false;
}

async function loadDashboard() {
    const myTeam = await window.pywebview.api.get_my_team();
    if (myTeam.error) return;

    dashboardTitle.textContent = `${myTeam.team_name}`;

    // Load roster
    rosterList.innerHTML = "";
    if (myTeam.roster.length === 0) {
        rosterList.innerHTML = "<li>No players yet.</li>";
    } else {
        myTeam.roster.forEach(player => {
            const li = document.createElement("li");
            li.innerHTML = `
                <span class="player-info"><span class="player-number">#${player.number}</span><span class="player-name">${player.first_name} ${player.last_name}</span></span>
                <button class="remove-player-btn" data-id="${player.id}">-</button>
            `;
            rosterList.appendChild(li);
        });

        rosterList.querySelectorAll(".remove-player-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                await window.pywebview.api.remove_player(myTeam.id, btn.dataset.id);
                await loadDashboard();
            });
        });
    }

    // Load games
    const rosterTeams = await window.pywebview.api.get_roster_teams();
    const teamMap = {};
    rosterTeams.forEach(t => { teamMap[t.id] = t.team_name; });

    const games = await window.pywebview.api.get_games();
    gamesActive.innerHTML = "";
    gamesFinished.innerHTML = "";
    noActive.classList.remove("hidden");
    noFinished.classList.remove("hidden");

    games.forEach(game => {
        const oppName = teamMap[game.opponent_id] || game.opponent_id;
        addGameCard({
            id: game.id,
            opponent: oppName,
            opponent_id: game.opponent_id,
            home_away: game.home_away,
            home_score: game.home_score,
            away_score: game.away_score,
            status: game.status,
            home_lineup: game.home_lineup || [],
            away_lineup: game.away_lineup || [],
            state: game.state || null,
        });
    });
}

// --- Home screen ---

showCreateBtn.addEventListener("click", () => {
    createError.classList.add("hidden");
    createForm.reset();
    showScreen(createScreen);
});

cancelCreateBtn.addEventListener("click", () => {
    showScreen(homeScreen);
});

createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("team-name").value;
    const ageGroup = document.getElementById("age-group").value;
    const location = document.getElementById("location").value;

    const result = await window.pywebview.api.create_team(name, ageGroup, location);

    if (result.error) {
        createError.textContent = result.error;
        createError.classList.remove("hidden");
        return;
    }

    await loadTeams();
    showScreen(homeScreen);
});

openTeamBtn.addEventListener("click", async () => {
    const directory = teamSelect.value;
    if (!directory) return;
    await window.pywebview.api.select_team(directory);
    await loadDashboard();
    showScreen(dashboardScreen);
});

backHomeBtn.addEventListener("click", () => {
    document.querySelectorAll(".modal-overlay").forEach(m => m.classList.add("hidden"));
    showScreen(homeScreen);
});

// --- Add Player Modal ---

addPlayerBtn.addEventListener("click", () => {
    addPlayerForm.reset();
    playerError.classList.add("hidden");
    addPlayerModal.classList.remove("hidden");
});

cancelPlayerBtn.addEventListener("click", () => {
    addPlayerModal.classList.add("hidden");
});

addPlayerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const number = document.getElementById("player-number").value;
    const firstName = document.getElementById("player-first").value;
    const lastName = document.getElementById("player-last").value;

    const myTeam = await window.pywebview.api.get_my_team();
    if (myTeam.error) return;

    const result = await window.pywebview.api.add_player(myTeam.id, number, firstName, lastName);
    if (result.error) {
        playerError.textContent = result.error;
        playerError.classList.remove("hidden");
        return;
    }

    addPlayerModal.classList.add("hidden");
    await loadDashboard();
});

// --- Create Game Modal ---

const gameOpponentInput = document.getElementById("game-opponent");
const opponentSuggestions = document.getElementById("opponent-suggestions");
let rosterTeamsCache = [];

createGameBtn.addEventListener("click", async () => {
    createGameForm.reset();
    gameError.classList.add("hidden");
    opponentSuggestions.classList.add("hidden");
    rosterTeamsCache = await window.pywebview.api.get_roster_teams();
    createGameModal.classList.remove("hidden");
});

gameOpponentInput.addEventListener("input", () => {
    const query = gameOpponentInput.value.trim().toLowerCase();
    opponentSuggestions.innerHTML = "";

    if (!query) {
        opponentSuggestions.classList.add("hidden");
        return;
    }

    const matches = rosterTeamsCache.filter(t =>
        !t.my_team && t.team_name.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
        opponentSuggestions.classList.add("hidden");
        return;
    }

    matches.forEach(t => {
        const li = document.createElement("li");
        li.textContent = t.team_name;
        li.addEventListener("click", () => {
            gameOpponentInput.value = t.team_name;
            opponentSuggestions.classList.add("hidden");
        });
        opponentSuggestions.appendChild(li);
    });
    opponentSuggestions.classList.remove("hidden");
});

// Hide suggestions when clicking outside
createGameModal.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-wrap")) {
        opponentSuggestions.classList.add("hidden");
    }
});

cancelGameBtn.addEventListener("click", () => {
    createGameModal.classList.add("hidden");
});

createGameForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const opponent = document.getElementById("game-opponent").value;
    const homeAway = document.getElementById("game-home-away").value;
    const location = document.getElementById("game-location").value;

    const result = await window.pywebview.api.create_game(opponent, homeAway, location);
    if (result.error) {
        gameError.textContent = result.error;
        gameError.classList.remove("hidden");
        return;
    }

    createGameModal.classList.add("hidden");
    await loadDashboard();
});

// --- Enter Game Modal ---

const enterGameModal = document.getElementById("enter-game-modal");
const cancelEnterGameBtn = document.getElementById("cancel-enter-game-btn");

const startGameBtn = document.getElementById("start-game-btn");
const gameScreen = document.getElementById("game-screen");
const gameScreenTitle = document.getElementById("game-screen-title");
const backDashboardBtn = document.getElementById("back-dashboard-btn");
const saveGameBtn = document.getElementById("save-game-btn");

cancelEnterGameBtn.addEventListener("click", () => {
    enterGameModal.classList.add("hidden");
});

enterGameModal.addEventListener("click", (e) => {
    if (e.target === enterGameModal) enterGameModal.classList.add("hidden");
});

startGameBtn.addEventListener("click", async () => {
    enterGameModal.classList.add("hidden");

    const myTeam = await window.pywebview.api.get_my_team();
    const homeName = selectedGame.home_away === "home" ? myTeam.team_name : selectedGame.opponent;
    const awayName = selectedGame.home_away === "away" ? myTeam.team_name : selectedGame.opponent;

    document.getElementById("sb-home-name").textContent = homeName;
    document.getElementById("sb-away-name").textContent = awayName;
    document.getElementById("sb-home-score").textContent = selectedGame.home_score;
    document.getElementById("sb-away-score").textContent = selectedGame.away_score;

    // Restore or reset game state
    const saved = selectedGame.state;
    if (saved) {
        inningNum = saved.inning_num || 1;
        inningHalf = saved.inning_half || "top";
        balls = saved.balls || 0;
        strikes = saved.strikes || 0;
        outs = saved.outs || 0;
        const savedBases = saved.bases || { first: null, second: null, third: null };
        // Convert old boolean format to player ID format
        bases = {
            first: (savedBases.first === true || savedBases.first === false) ? null : savedBases.first,
            second: (savedBases.second === true || savedBases.second === false) ? null : savedBases.second,
            third: (savedBases.third === true || savedBases.third === false) ? null : savedBases.third,
        };
        homeBatterIdx = saved.home_batter_idx || 0;
        awayBatterIdx = saved.away_batter_idx || 0;
    } else {
        inningNum = 1;
        inningHalf = "top";
        balls = 0;
        strikes = 0;
        outs = 0;
        bases = { first: null, second: null, third: null };
        homeBatterIdx = 0;
        awayBatterIdx = 0;
    }
    updateGameState();
    markSaveClean();

    showScreen(gameScreen);
    await loadLineups();
});

function markSaveDirty() {
    saveGameBtn.className = "save-btn save-dirty";
}

function markSaveClean() {
    saveGameBtn.className = "save-btn save-clean";
}

saveGameBtn.addEventListener("click", async () => {
    const homeScore = parseInt(document.getElementById("sb-home-score").textContent);
    const awayScore = parseInt(document.getElementById("sb-away-score").textContent);
    const state = {
        inning_num: inningNum,
        inning_half: inningHalf,
        balls: balls,
        strikes: strikes,
        outs: outs,
        bases: { first: bases.first, second: bases.second, third: bases.third },
        home_batter_idx: homeBatterIdx,
        away_batter_idx: awayBatterIdx,
    };
    await window.pywebview.api.update_game_state(state);
    await window.pywebview.api.update_score(homeScore, awayScore);
    await window.pywebview.api.save_game();
    markSaveClean();
});

backDashboardBtn.addEventListener("click", async () => {
    // Close all open modals/menus
    hidePitchMenu();
    clearPitchDots();
    document.querySelectorAll(".modal-overlay").forEach(m => m.classList.add("hidden"));
    await loadDashboard();
    showScreen(dashboardScreen);
});

// --- Close modals on overlay click ---

addPlayerModal.addEventListener("click", (e) => {
    if (e.target === addPlayerModal) addPlayerModal.classList.add("hidden");
});

createGameModal.addEventListener("click", (e) => {
    if (e.target === createGameModal) createGameModal.classList.add("hidden");
});

// --- Position Picker ---

const posPickerModal = document.getElementById("position-picker-modal");
const posPickerTitle = document.getElementById("position-picker-title");
let posPickerResolve = null;

function pickPosition(playerName) {
    return new Promise((resolve) => {
        posPickerTitle.textContent = `Position for ${playerName}`;
        posPickerResolve = resolve;
        posPickerModal.classList.remove("hidden");
    });
}

document.querySelectorAll(".pos-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        posPickerModal.classList.add("hidden");
        const pos = btn.dataset.pos === "None" ? "" : btn.dataset.pos;
        if (posPickerResolve) {
            posPickerResolve(pos);
            posPickerResolve = null;
        }
    });
});

posPickerModal.addEventListener("click", (e) => {
    if (e.target === posPickerModal) {
        posPickerModal.classList.add("hidden");
        if (posPickerResolve) {
            posPickerResolve(null);
            posPickerResolve = null;
        }
    }
});

// --- Lineup drag and drop ---

// Lineup entries are {id, position} objects

function makeLineupItem(player, showOrder, orderNum, position) {
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.playerId = player.id;
    li.innerHTML = `
        ${showOrder ? `<span class="lineup-order">${orderNum}.</span>` : ""}
        <span class="lineup-num">#${player.number}</span>
        <span>${player.first_name.charAt(0)}. ${player.last_name}</span>
        ${showOrder && position ? `<span class="lineup-pos">${position}</span>` : ""}
    `;
    li.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", player.id);
        e.dataTransfer.effectAllowed = "move";
    });
    return li;
}

function setupDropZone(listEl, onDrop) {
    listEl.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        listEl.classList.add("drag-hover");
    });
    listEl.addEventListener("dragleave", () => {
        listEl.classList.remove("drag-hover");
    });
    listEl.addEventListener("drop", (e) => {
        e.preventDefault();
        listEl.classList.remove("drag-hover");
        const playerId = e.dataTransfer.getData("text/plain");
        onDrop(playerId);
    });
}

let homeLineup = [];  // [{id, position}]
let awayLineup = [];
let homePlayers = [];
let awayPlayers = [];
let homeConfirmed = [];
let awayConfirmed = [];
let homeBatterIdx = 0;
let awayBatterIdx = 0;
let inningHalf = "bottom";
let inningNum = 1;
let balls = 0;
let strikes = 0;
let outs = 0;
let bases = { first: null, second: null, third: null };
let lastPitchId = null;

function lineupIds(side) {
    return (side === "home" ? homeLineup : awayLineup).map(e => e.id);
}

function markConfirmBtn(side) {
    const btn = document.getElementById(`confirm-${side}-lineup`);
    const lineup = side === "home" ? homeLineup : awayLineup;
    const confirmed = side === "home" ? homeConfirmed : awayConfirmed;
    const isDirty = JSON.stringify(lineup) !== JSON.stringify(confirmed);
    btn.className = isDirty ? "btn-small btn-dirty" : "btn-small btn-confirmed";
}

function renderLineup(side) {
    const lineupList = document.getElementById(`${side}-lineup`);
    const availableList = document.getElementById(`${side}-available`);
    const lineup = side === "home" ? homeLineup : awayLineup;
    const allPlayers = side === "home" ? homePlayers : awayPlayers;
    const ids = lineup.map(e => e.id);

    lineupList.innerHTML = "";
    availableList.innerHTML = "";

    const battingSide = inningHalf === "top" ? "away" : "home";
    const fieldingSide = inningHalf === "top" ? "home" : "away";
    const batterIdx = side === "home" ? homeBatterIdx : awayBatterIdx;

    lineup.forEach((entry, i) => {
        const p = allPlayers.find(pl => pl.id === entry.id);
        if (!p) return;
        const li = makeLineupItem(p, true, i + 1, entry.position);
        if (side === battingSide && i === batterIdx) {
            li.classList.add("lineup-batter");
        }
        if (side === fieldingSide && entry.position === "P") {
            li.classList.add("lineup-pitcher");
        }
        lineupList.appendChild(li);
    });

    allPlayers.filter(p => !ids.includes(p.id)).forEach(p => {
        availableList.appendChild(makeLineupItem(p, false));
    });

    if (lineupList.children.length === 0) {
        lineupList.innerHTML = '<li style="color:#999;cursor:default;font-style:italic">Drag here</li>';
    }
    if (availableList.children.length === 0) {
        availableList.innerHTML = '<li style="color:#999;cursor:default;font-style:italic">None</li>';
    }

    markConfirmBtn(side);
    updateInfoBar();
}

function updateGameState() {
    // Inning
    document.getElementById("sb-inning-half").textContent = inningHalf === "top" ? "TOP" : "BOT";
    document.getElementById("sb-inning-num").textContent = inningNum;

    // Count
    document.getElementById("sb-balls").textContent = balls;
    document.getElementById("sb-strikes").textContent = strikes;

    // Outs
    document.getElementById("sb-out-1").classList.toggle("active", outs >= 1);
    document.getElementById("sb-out-2").classList.toggle("active", outs >= 2);
    document.getElementById("sb-out-3").classList.toggle("active", outs >= 3);

    // Bases (score bug)
    document.getElementById("sb-base-1").classList.toggle("active", !!bases.first);
    document.getElementById("sb-base-2").classList.toggle("active", !!bases.second);
    document.getElementById("sb-base-3").classList.toggle("active", !!bases.third);

    // Bases (bottom-right display)
    const gb1 = document.getElementById("game-base-1");
    const gb2 = document.getElementById("game-base-2");
    const gb3 = document.getElementById("game-base-3");
    if (gb1) gb1.classList.toggle("active", !!bases.first);
    if (gb2) gb2.classList.toggle("active", !!bases.second);
    if (gb3) gb3.classList.toggle("active", !!bases.third);

    updateInfoBar();
}

function updateInfoBar() {
    const battingSide = inningHalf === "top" ? "away" : "home";
    const fieldingSide = inningHalf === "top" ? "home" : "away";
    const battingLineup = battingSide === "home" ? homeLineup : awayLineup;
    const battingPlayers = battingSide === "home" ? homePlayers : awayPlayers;
    const fieldingLineup = fieldingSide === "home" ? homeLineup : awayLineup;
    const fieldingPlayers = fieldingSide === "home" ? homePlayers : awayPlayers;
    const batterIdx = battingSide === "home" ? homeBatterIdx : awayBatterIdx;

    // Batter
    const batterEntry = battingLineup[batterIdx];
    if (batterEntry) {
        const batter = battingPlayers.find(p => p.id === batterEntry.id);
        document.getElementById("sb-batter-name").textContent = batter
            ? `${batter.first_name} ${batter.last_name}` : "--";
    } else {
        document.getElementById("sb-batter-name").textContent = "--";
    }

    // Pitcher
    const pitcherEntry = fieldingLineup.find(e => e.position === "P");
    if (pitcherEntry) {
        const pitcher = fieldingPlayers.find(p => p.id === pitcherEntry.id);
        document.getElementById("sb-pitcher-name").textContent = pitcher
            ? `${pitcher.first_name} ${pitcher.last_name}` : "--";
    } else {
        document.getElementById("sb-pitcher-name").textContent = "--";
    }
}

function initLineupDropZones() {
    ["home", "away"].forEach(side => {
        const lineupList = document.getElementById(`${side}-lineup`);
        const availableList = document.getElementById(`${side}-available`);
        const lineupRef = () => side === "home" ? homeLineup : awayLineup;
        const playersRef = () => side === "home" ? homePlayers : awayPlayers;

        setupDropZone(lineupList, async (playerId) => {
            const lineup = lineupRef();
            const existing = lineup.find(e => e.id === playerId);
            const player = playersRef().find(p => p.id === playerId);
            if (!player) return;
            const name = `${player.first_name.charAt(0)}. ${player.last_name}`;
            const pos = await pickPosition(name);
            if (pos === null) return; // cancelled
            if (existing) {
                existing.position = pos;
            } else {
                lineup.push({ id: playerId, position: pos });
            }
            renderLineup(side);
        });

        setupDropZone(availableList, (playerId) => {
            const lineup = lineupRef();
            const idx = lineup.findIndex(e => e.id === playerId);
            if (idx !== -1) lineup.splice(idx, 1);
            renderLineup(side);
        });
    });
}

function parseLineup(raw) {
    if (!raw || raw.length === 0) return [];
    // Support old format (array of strings) and new format (array of objects)
    return raw.map(entry => {
        if (typeof entry === "string") return { id: entry, position: "" };
        return { id: entry.id, position: entry.position || "" };
    });
}

async function loadLineups() {
    const myTeam = await window.pywebview.api.get_my_team();
    if (myTeam.error) return;

    const rosterTeams = await window.pywebview.api.get_roster_teams();

    if (selectedGame.home_away === "home") {
        homePlayers = myTeam.roster || [];
        const oppTeam = rosterTeams.find(t => t.id === selectedGame.opponent_id);
        awayPlayers = oppTeam ? (oppTeam.roster || []) : [];
    } else {
        awayPlayers = myTeam.roster || [];
        const oppTeam = rosterTeams.find(t => t.id === selectedGame.opponent_id);
        homePlayers = oppTeam ? (oppTeam.roster || []) : [];
    }

    homeLineup = parseLineup(selectedGame.home_lineup);
    awayLineup = parseLineup(selectedGame.away_lineup);
    homeConfirmed = JSON.parse(JSON.stringify(homeLineup));
    awayConfirmed = JSON.parse(JSON.stringify(awayLineup));

    renderLineup("home");
    renderLineup("away");
}

document.getElementById("confirm-home-lineup").addEventListener("click", async () => {
    await window.pywebview.api.set_lineup("home", homeLineup);
    await window.pywebview.api.save_game();
    homeConfirmed = JSON.parse(JSON.stringify(homeLineup));
    markConfirmBtn("home");
});

document.getElementById("confirm-away-lineup").addEventListener("click", async () => {
    await window.pywebview.api.set_lineup("away", awayLineup);
    await window.pywebview.api.save_game();
    awayConfirmed = JSON.parse(JSON.stringify(awayLineup));
    markConfirmBtn("away");
});

initLineupDropZones();

// --- Game-screen Add Player ---

let gameAddPlayerSide = null;

const gameAddPlayerModal = document.getElementById("game-add-player-modal");
const gameAddPlayerForm = document.getElementById("game-add-player-form");
const gamePlayerError = document.getElementById("game-player-error");

function getTeamIdForSide(side) {
    if (!selectedGame) return null;
    const rosterTeams = side === "home" ? homePlayers : awayPlayers;
    // We need the team id, not the player list. Determine from selectedGame.
    if (selectedGame.home_away === "home") {
        return side === "home" ? null : selectedGame.opponent_id; // null = my team
    } else {
        return side === "away" ? null : selectedGame.opponent_id;
    }
}

document.getElementById("game-add-home-player").addEventListener("click", () => {
    gameAddPlayerSide = "home";
    document.getElementById("game-add-player-title").textContent = "Add Home Player";
    gameAddPlayerForm.reset();
    gamePlayerError.classList.add("hidden");
    gameAddPlayerModal.classList.remove("hidden");
});

document.getElementById("game-add-away-player").addEventListener("click", () => {
    gameAddPlayerSide = "away";
    document.getElementById("game-add-player-title").textContent = "Add Away Player";
    gameAddPlayerForm.reset();
    gamePlayerError.classList.add("hidden");
    gameAddPlayerModal.classList.remove("hidden");
});

document.getElementById("cancel-game-player-btn").addEventListener("click", () => {
    gameAddPlayerModal.classList.add("hidden");
});

gameAddPlayerModal.addEventListener("click", (e) => {
    if (e.target === gameAddPlayerModal) gameAddPlayerModal.classList.add("hidden");
});

gameAddPlayerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const number = document.getElementById("game-player-number").value;
    const firstName = document.getElementById("game-player-first").value;
    const lastName = document.getElementById("game-player-last").value;

    // Find the team id for this side
    const rosterTeams = await window.pywebview.api.get_roster_teams();
    const myTeam = await window.pywebview.api.get_my_team();
    let teamId;

    if (selectedGame.home_away === "home") {
        teamId = gameAddPlayerSide === "home" ? myTeam.id : selectedGame.opponent_id;
    } else {
        teamId = gameAddPlayerSide === "away" ? myTeam.id : selectedGame.opponent_id;
    }

    const result = await window.pywebview.api.add_player(teamId, number, firstName, lastName);
    if (result.error) {
        gamePlayerError.textContent = result.error;
        gamePlayerError.classList.remove("hidden");
        return;
    }

    gameAddPlayerModal.classList.add("hidden");
    await loadLineups();
});

// --- Pitch Menu ---

const pitchMenu = document.getElementById("pitch-menu");
let pitchClickX = 0;
let pitchClickY = 0;

function showPitchMenu(x, y) {
    pitchClickX = x;
    pitchClickY = y;

    // Temporarily show off-screen to measure height
    pitchMenu.style.left = "-9999px";
    pitchMenu.style.top = "-9999px";
    pitchMenu.classList.remove("hidden");
    const menuH = pitchMenu.offsetHeight;
    const menuW = pitchMenu.offsetWidth;

    let left = x + 14;
    let top = y - 14;

    // Keep within viewport
    if (top + menuH > window.innerHeight) {
        top = window.innerHeight - menuH - 4;
    }
    if (left + menuW > window.innerWidth) {
        left = x - menuW - 14;
    }

    pitchMenu.style.left = left + "px";
    pitchMenu.style.top = top + "px";
    // Pin the ball in place at click location
    ballCursor.style.left = x + "px";
    ballCursor.style.top = y + "px";
    ballCursor.style.display = "block";
    ballCursor.classList.add("pinned");
    document.body.style.cursor = "";
}

let pitchDots = [];

function placePitchDot(x, y) {
    const dot = document.createElement("div");
    dot.className = "pitch-dot finalized";
    dot.style.left = x + "px";
    dot.style.top = y + "px";
    document.body.appendChild(dot);
    pitchDots.push(dot);
}

function clearPitchDots() {
    pitchDots.forEach(dot => dot.remove());
    pitchDots = [];
}

function hidePitchMenu() {
    pitchMenu.classList.add("hidden");
    document.getElementById("hit-submenu").classList.add("hidden");
    document.getElementById("hit-type-submenu").classList.add("hidden");
    ballCursor.classList.remove("pinned");
}

function advanceBatter() {
    const battingSide = inningHalf === "top" ? "away" : "home";
    const lineup = battingSide === "home" ? homeLineup : awayLineup;
    if (battingSide === "home") {
        homeBatterIdx = (homeBatterIdx + 1) % Math.max(lineup.length, 1);
    } else {
        awayBatterIdx = (awayBatterIdx + 1) % Math.max(lineup.length, 1);
    }
}

function resetCount() {
    balls = 0;
    strikes = 0;
}

function recordOut() {
    outs++;
    resetCount();
    endAtBat();
    if (outs >= 3) {
        // Switch half inning
        outs = 0;
        bases = { first: null, second: null, third: null };
        if (inningHalf === "top") {
            inningHalf = "bottom";
        } else {
            inningHalf = "top";
            inningNum++;
        }
    }
    advanceBatter();
    updateGameState();
    renderLineup("home");
    renderLineup("away");
}

function advanceRunnersForWalk() {
    // Forced advancement for walks/HBP — only push runners when forced
    const battingSide = inningHalf === "top" ? "away" : "home";
    if (bases.first && bases.second && bases.third) {
        // Bases loaded — runner on third scores
        if (battingSide === "home") { selectedGame.home_score++; } else { selectedGame.away_score++; }
        document.getElementById("sb-home-score").textContent = selectedGame.home_score;
        document.getElementById("sb-away-score").textContent = selectedGame.away_score;
        bases.third = bases.second;
        bases.second = bases.first;
    } else if (bases.first && bases.second) {
        bases.third = bases.second;
        bases.second = bases.first;
    } else if (bases.first) {
        bases.second = bases.first;
    }
    bases.first = null;
}

function endAtBat() {
    setTimeout(() => clearPitchDots(), 600);
}

function getCurrentBatterId() {
    const battingSide = inningHalf === "top" ? "away" : "home";
    const lineup = battingSide === "home" ? homeLineup : awayLineup;
    const idx = battingSide === "home" ? homeBatterIdx : awayBatterIdx;
    return lineup[idx] ? lineup[idx].id : null;
}

function getCurrentPitcherId() {
    const fieldingSide = inningHalf === "top" ? "home" : "away";
    const lineup = fieldingSide === "home" ? homeLineup : awayLineup;
    const entry = lineup.find(e => e.position === "P");
    return entry ? entry.id : null;
}

function buildPitchData(outcome, hitResult, hitType) {
    return {
        batter_id: getCurrentBatterId(),
        pitcher_id: getCurrentPitcherId(),
        inning: inningNum,
        half: inningHalf,
        balls: balls,
        strikes: strikes,
        outs: outs,
        runners: {
            first_id: bases.first || null,
            second_id: bases.second || null,
            third_id: bases.third || null,
        },
        loc_x: pitchClickX,
        loc_y: pitchClickY,
        outcome: outcome,
        hit_result: hitResult || null,
        hit_type: hitType || null,
        home_score: selectedGame.home_score,
        away_score: selectedGame.away_score,
    };
}

async function recordPitch(outcome, hitResult, hitType) {
    const data = buildPitchData(outcome, hitResult, hitType);
    const result = await window.pywebview.api.pitch(data);
    if (result && result.pitches && result.pitches.length > 0) {
        lastPitchId = result.pitches[result.pitches.length - 1].id;
    }
}

function handlePitchOutcome(outcome) {
    markSaveDirty();
    placePitchDot(pitchClickX, pitchClickY);
    let atBatOver = false;

    // Snapshot pre-outcome state for pitch data
    const preOutcome = outcome;

    switch (outcome) {
        case "Strike":
            strikes++;
            if (strikes >= 3) {
                recordPitch("strikeout");
                recordOut();
                return;
            }
            break;

        case "Foul":
            if (strikes < 2) {
                strikes++;
            }
            break;

        case "Foul Tip":
            strikes++;
            if (strikes >= 3) {
                recordPitch("strikeout");
                recordOut();
                return;
            }
            break;

        case "Ball":
            balls++;
            if (balls >= 4) {
                atBatOver = true;
                recordPitch("walk");
                advanceRunnersForWalk();
                bases.first = getCurrentBatterId();
                resetCount();
                advanceBatter();
            }
            break;

        case "HBP":
            atBatOver = true;
            recordPitch("hbp");
            advanceRunnersForWalk();
            bases.first = getCurrentBatterId();
            resetCount();
            advanceBatter();
            break;

        case "Hit":
            // Handled by hit submenu via handleHitOutcome
            return;
    }

    if (!atBatOver) {
        recordPitch(outcome.toLowerCase());
    }

    if (atBatOver) endAtBat();
    updateGameState();
    renderLineup("home");
    renderLineup("away");
}

function getPlayerName(playerId) {
    const battingSide = inningHalf === "top" ? "away" : "home";
    const players = battingSide === "home" ? homePlayers : awayPlayers;
    const p = players.find(pl => pl.id === playerId);
    return p ? `#${p.number} ${p.first_name.charAt(0)}. ${p.last_name}` : playerId;
}

function getDefaultOutcome(startBase, hitResult) {
    // Returns the default ending base for a runner given the hit type
    switch (hitResult) {
        case "Single":
            if (startBase === "third") return "home";
            if (startBase === "second") return "third";
            if (startBase === "first") return "second";
            if (startBase === "batter") return "first";
            break;
        case "Double":
            if (startBase === "third") return "home";
            if (startBase === "second") return "home";
            if (startBase === "first") return "third";
            if (startBase === "batter") return "second";
            break;
        case "Triple":
            if (startBase === "batter") return "third";
            return "home";
        case "Home Run":
            return "home";
        case "Out":
            if (startBase === "batter") return "out_at_first";
            return startBase; // runners stay by default
        case "Error":
            if (startBase === "third") return "home";
            if (startBase === "second") return "third";
            if (startBase === "first") return "second";
            if (startBase === "batter") return "first";
            break;
    }
    return startBase;
}

function getOutcomeOptions(startBase) {
    // Returns available dropdown options based on starting base
    const options = [];
    const baseNames = { first: "1st", second: "2nd", third: "3rd", home: "Home (score)" };
    const allBases = ["first", "second", "third", "home"];
    const startIdx = startBase === "batter" ? -1 : allBases.indexOf(startBase);

    // Can advance to any base ahead
    for (let i = startIdx + 1; i < allBases.length; i++) {
        options.push({ value: allBases[i], label: baseNames[allBases[i]] });
    }

    // Out options — at any base ahead
    for (let i = startIdx + 1; i < allBases.length; i++) {
        options.push({ value: `out_at_${allBases[i]}`, label: `Out at ${baseNames[allBases[i]]}` });
    }

    // Stay on base (for non-batter)
    if (startBase !== "batter") {
        options.unshift({ value: startBase, label: `Stay at ${baseNames[startBase]}` });
    }

    return options;
}

function showRunnerResolution(hitResult, hitType) {
    const panel = document.getElementById("runner-resolution");
    const list = document.getElementById("runner-resolution-list");
    list.innerHTML = "";

    const batterId = getCurrentBatterId();
    const runners = [];

    // Add existing runners in order: third, second, first (top to bottom)
    if (bases.third) runners.push({ id: bases.third, startBase: "third" });
    if (bases.second) runners.push({ id: bases.second, startBase: "second" });
    if (bases.first) runners.push({ id: bases.first, startBase: "first" });
    // Add batter
    runners.push({ id: batterId, startBase: "batter" });

    runners.forEach(runner => {
        const row = document.createElement("div");
        row.className = "runner-resolution-row";

        const nameSpan = document.createElement("span");
        nameSpan.className = "runner-name";
        nameSpan.textContent = getPlayerName(runner.id);
        row.appendChild(nameSpan);

        const select = document.createElement("select");
        select.dataset.playerId = runner.id;
        select.dataset.startBase = runner.startBase;

        const options = getOutcomeOptions(runner.startBase);
        const defaultOutcome = getDefaultOutcome(runner.startBase, hitResult);

        options.forEach(opt => {
            const option = document.createElement("option");
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === defaultOutcome) option.selected = true;
            select.appendChild(option);
        });

        row.appendChild(select);
        list.appendChild(row);
    });

    panel.classList.remove("hidden");

    // Store hit info for confirm handler
    panel.dataset.hitResult = hitResult;
    panel.dataset.hitType = hitType;
}

function handleHitOutcome(hitResult, hitType) {
    markSaveDirty();
    placePitchDot(pitchClickX, pitchClickY);

    const outcomeMap = {
        "Single": "single", "Double": "double", "Triple": "triple",
        "Home Run": "home_run", "Out": "out", "Error": "error",
    };
    recordPitch(outcomeMap[hitResult] || hitResult.toLowerCase(), hitResult, hitType);

    showRunnerResolution(hitResult, hitType);
}

document.getElementById("runner-resolution-confirm").addEventListener("click", () => {
    const panel = document.getElementById("runner-resolution");
    const selects = panel.querySelectorAll("select");
    const battingSide = inningHalf === "top" ? "away" : "home";

    let outsThisPlay = 0;

    // Process each runner's outcome
    selects.forEach(sel => {
        const playerId = sel.dataset.playerId;
        const startBase = sel.dataset.startBase;
        const outcome = sel.value;

        // Clear runner from starting base
        if (startBase !== "batter" && bases[startBase] === playerId) {
            bases[startBase] = null;
        }

        if (outcome.startsWith("out_at_")) {
            // Runner is out
            outsThisPlay++;
            window.pywebview.api.record_baserunning({
                pitch_id: lastPitchId,
                baserunner_id: playerId,
                starting_base: startBase,
                ending_base: null,
                out: true,
                type: "Previous Play",
            });
        } else if (outcome === "home") {
            // Runner scores
            if (battingSide === "home") { selectedGame.home_score++; } else { selectedGame.away_score++; }
            window.pywebview.api.record_baserunning({
                pitch_id: lastPitchId,
                baserunner_id: playerId,
                starting_base: startBase,
                ending_base: "home",
                out: false,
                type: "Previous Play",
            });
        } else {
            // Runner advances to a base
            bases[outcome] = playerId;
            window.pywebview.api.record_baserunning({
                pitch_id: lastPitchId,
                baserunner_id: playerId,
                starting_base: startBase,
                ending_base: outcome,
                out: false,
                type: "Previous Play",
            });
        }
    });

    panel.classList.add("hidden");

    // Update scores display
    document.getElementById("sb-home-score").textContent = selectedGame.home_score;
    document.getElementById("sb-away-score").textContent = selectedGame.away_score;

    // Process outs
    resetCount();
    advanceBatter();
    endAtBat();

    for (let i = 0; i < outsThisPlay; i++) {
        outs++;
        if (outs >= 3) {
            outs = 0;
            bases = { first: null, second: null, third: null };
            if (inningHalf === "top") {
                inningHalf = "bottom";
            } else {
                inningHalf = "top";
                inningNum++;
            }
            break;
        }
    }

    updateGameState();
    renderLineup("home");
    renderLineup("away");
});

const hitSubmenu = document.getElementById("hit-submenu");

document.querySelectorAll("#pitch-menu .pitch-menu-item").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (btn.dataset.outcome === "Hit") {
            // Show hit submenu next to pitch menu
            const rect = pitchMenu.getBoundingClientRect();
            let left = rect.right + 2;
            let top = rect.top;
            hitSubmenu.style.left = left + "px";
            hitSubmenu.style.top = top + "px";
            hitSubmenu.classList.remove("hidden");

            // Keep within viewport
            const subH = hitSubmenu.offsetHeight;
            const subW = hitSubmenu.offsetWidth;
            if (top + subH > window.innerHeight) {
                hitSubmenu.style.top = (window.innerHeight - subH - 4) + "px";
            }
            if (left + subW > window.innerWidth) {
                hitSubmenu.style.left = (rect.left - subW - 2) + "px";
            }
            return;
        }
        hitSubmenu.classList.add("hidden");
        handlePitchOutcome(btn.dataset.outcome);
        hidePitchMenu();
    });
});

const hitTypeSubmenu = document.getElementById("hit-type-submenu");
let pendingHitResult = null;

function showHitTypeMenu(anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    let left = rect.right + 2;
    let top = rect.top;
    hitTypeSubmenu.style.left = left + "px";
    hitTypeSubmenu.style.top = top + "px";
    hitTypeSubmenu.classList.remove("hidden");

    const subH = hitTypeSubmenu.offsetHeight;
    const subW = hitTypeSubmenu.offsetWidth;
    if (top + subH > window.innerHeight) {
        hitTypeSubmenu.style.top = (window.innerHeight - subH - 4) + "px";
    }
    if (left + subW > window.innerWidth) {
        hitTypeSubmenu.style.left = (rect.left - subW - 2) + "px";
    }
}

document.querySelectorAll("#hit-submenu .pitch-menu-item").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        pendingHitResult = btn.dataset.hit;
        showHitTypeMenu(hitSubmenu);
    });
});

document.querySelectorAll("#hit-type-submenu .pitch-menu-item").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleHitOutcome(pendingHitResult, btn.dataset.hittype);
        hitTypeSubmenu.classList.add("hidden");
        hitSubmenu.classList.add("hidden");
        hidePitchMenu();
    });
});

document.getElementById("pitch-menu-cancel").addEventListener("click", (e) => {
    e.stopPropagation();
    hitTypeSubmenu.classList.add("hidden");
    hitSubmenu.classList.add("hidden");
    hidePitchMenu();
});

document.getElementById("hit-submenu-cancel").addEventListener("click", (e) => {
    e.stopPropagation();
    hitTypeSubmenu.classList.add("hidden");
    hitSubmenu.classList.add("hidden");
});

document.getElementById("hit-type-cancel").addEventListener("click", (e) => {
    e.stopPropagation();
    hitTypeSubmenu.classList.add("hidden");
});

// Click anywhere to show pitch menu (when game screen is active)
document.addEventListener("mousedown", (e) => {
    if (!pitchMenu.classList.contains("hidden")) return;
    if (gameScreen.classList.contains("hidden")) return;
    if (e.target.closest("button, .lineup-panel, .modal-overlay, .score-bug, .pitch-menu, .game-bases-display, #runner-menu, #runner-resolution, select, input")) return;

    showPitchMenu(e.clientX, e.clientY);
});

// --- Ball cursor on game screen ---

const ballCursor = document.getElementById("ball-cursor");
const interactiveSelectors = "button, a, input, select, textarea, .lineup-list li, .pos-btn, .modal-overlay, .modal, .game-bases-display";

document.addEventListener("mousemove", (e) => {
    if (gameScreen.classList.contains("hidden")) {
        ballCursor.style.display = "none";
        document.body.style.cursor = "";
        return;
    }

    if (ballCursor.classList.contains("pinned")) {
        document.body.style.cursor = "";
        return;
    }

    ballCursor.style.left = e.clientX + "px";
    ballCursor.style.top = e.clientY + "px";

    const over = e.target.closest(interactiveSelectors);
    if (over) {
        ballCursor.style.display = "none";
        document.body.style.cursor = "";
    } else {
        ballCursor.style.display = "block";
        document.body.style.cursor = "none";
    }
});

document.addEventListener("mouseleave", () => {
    ballCursor.style.display = "none";
    document.body.style.cursor = "";
});

// --- Runner Base Dragging ---

const basesSvg = document.getElementById("bases-svg");
const runnerDragDot = document.getElementById("runner-drag-dot");
const homeBase = document.getElementById("game-base-home");
const runnerMenu = document.getElementById("runner-menu");
const basesDisplay = document.querySelector(".game-bases-display");

const baseOrder = ["first", "second", "third", "home"];
let draggingFrom = null;
let isDraggingRunner = false;

// SVG center coords for each base (from viewBox)
const baseSvgCenters = {
    first:  { x: 179, y: 110 },
    second: { x: 115, y: 46 },
    third:  { x: 51,  y: 110 },
    home:   { x: 115, y: 174 },
};

function getBasePageCenter(name) {
    const svgEl = document.getElementById("bases-svg");
    const svgRect = svgEl.getBoundingClientRect();
    const svgWidth = 230; // viewBox width
    const svgHeight = 230; // viewBox height
    const scaleX = svgRect.width / svgWidth;
    const scaleY = svgRect.height / svgHeight;
    const c = baseSvgCenters[name];
    return {
        x: svgRect.left + c.x * scaleX,
        y: svgRect.top + c.y * scaleY,
    };
}

function getBaseElByName(name) {
    if (name === "first") return document.getElementById("game-base-1");
    if (name === "second") return document.getElementById("game-base-2");
    if (name === "third") return document.getElementById("game-base-3");
    if (name === "home") return document.getElementById("game-base-home");
    return null;
}

function findDropBase(x, y) {
    const threshold = 60;
    for (const name of baseOrder) {
        if (name === draggingFrom) continue;
        const c = getBasePageCenter(name);
        const dist = Math.sqrt((x - c.x) ** 2 + (y - c.y) ** 2);
        if (dist < threshold) return name;
    }
    return null;
}

function isAdvance(from, to) {
    const fromIdx = baseOrder.indexOf(from);
    const toIdx = baseOrder.indexOf(to);
    return toIdx > fromIdx;
}

function showRunnerMenu(x, y, options, callback) {
    runnerMenu.innerHTML = "";
    options.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "pitch-menu-item";
        btn.textContent = opt;
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            runnerMenu.classList.add("hidden");
            callback(opt);
        });
        runnerMenu.appendChild(btn);
    });
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "pitch-menu-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        runnerMenu.classList.add("hidden");
    });
    runnerMenu.appendChild(cancelBtn);

    runnerMenu.style.left = x + "px";
    runnerMenu.style.top = y + "px";
    runnerMenu.classList.remove("hidden");

    // Keep in viewport
    const menuH = runnerMenu.offsetHeight;
    const menuW = runnerMenu.offsetWidth;
    if (parseInt(runnerMenu.style.top) + menuH > window.innerHeight) {
        runnerMenu.style.top = (window.innerHeight - menuH - 4) + "px";
    }
    if (parseInt(runnerMenu.style.left) + menuW > window.innerWidth) {
        runnerMenu.style.left = (x - menuW) + "px";
    }
}

function applyRunnerMove(from, to, reason) {
    markSaveDirty();
    const battingSide = inningHalf === "top" ? "away" : "home";
    const runnerId = bases[from];

    // Record baserunning event
    window.pywebview.api.record_baserunning({
        pitch_id: lastPitchId,
        baserunner_id: runnerId,
        starting_base: from,
        ending_base: to,
        out: false,
        type: reason,
    });

    // Clear origin
    bases[from] = null;

    if (to === "home") {
        // Runner scores
        if (battingSide === "home") { selectedGame.home_score++; } else { selectedGame.away_score++; }
        document.getElementById("sb-home-score").textContent = selectedGame.home_score;
        document.getElementById("sb-away-score").textContent = selectedGame.away_score;
    } else {
        bases[to] = runnerId;
    }

    updateGameState();
    renderLineup("home");
    renderLineup("away");
}

function applyRunnerOut(from, reason) {
    markSaveDirty();
    const runnerId = bases[from];

    // Record baserunning event
    window.pywebview.api.record_baserunning({
        pitch_id: lastPitchId,
        baserunner_id: runnerId,
        starting_base: from,
        ending_base: null,
        out: true,
        type: reason,
    });

    bases[from] = null;
    recordOut();
}

// Mouse handlers for base dragging
basesSvg.addEventListener("mousedown", (e) => {
    const baseEl = e.target.closest(".base-large.active");
    if (!baseEl) return;
    e.preventDefault();
    e.stopPropagation();

    draggingFrom = baseEl.dataset.base;
    isDraggingRunner = true;


    // Show drag dot
    const displayRect = basesDisplay.getBoundingClientRect();
    runnerDragDot.style.display = "block";
    runnerDragDot.style.left = (e.clientX - displayRect.left) + "px";
    runnerDragDot.style.top = (e.clientY - displayRect.top) + "px";
});

document.addEventListener("mousemove", (e) => {
    if (!isDraggingRunner) return;
    const displayRect = basesDisplay.getBoundingClientRect();
    runnerDragDot.style.left = (e.clientX - displayRect.left) + "px";
    runnerDragDot.style.top = (e.clientY - displayRect.top) + "px";

    // Highlight drop target
    document.querySelectorAll(".base-large, .base-home").forEach(el => el.classList.remove("drop-target"));
    const target = findDropBase(e.clientX, e.clientY);
    if (target) {
        const el = getBaseElByName(target);
        if (el) el.classList.add("drop-target");
    }
});

document.addEventListener("mouseup", (e) => {
    if (!isDraggingRunner) return;
    isDraggingRunner = false;
    runnerDragDot.style.display = "none";
    document.querySelectorAll(".base-large, .base-home").forEach(el => el.classList.remove("drop-target"));

    const dropBase = findDropBase(e.clientX, e.clientY);
    const from = draggingFrom;
    draggingFrom = null;

    if (dropBase && isAdvance(from, dropBase)) {
        // Advance — show advance options
        showRunnerMenu(e.clientX + 14, e.clientY - 14,
            ["Previous Play", "Stolen Base", "Wild Pitch", "Passed Ball"],
            (reason) => applyRunnerMove(from, dropBase, reason)
        );
    } else if (!dropBase || !isAdvance(from, dropBase)) {
        // Dropped in no-man's land or on same/earlier base — out options
        if (dropBase === from) return; // dropped back on same base, cancel
        showRunnerMenu(e.clientX + 14, e.clientY - 14,
            ["Caught Stealing", "Picked Off", "Previous Play"],
            (reason) => applyRunnerOut(from, reason)
        );
    }
});

// --- Init ---

window.addEventListener("pywebviewready", () => {
    loadTeams();
});
