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

createGameBtn.addEventListener("click", () => {
    createGameForm.reset();
    gameError.classList.add("hidden");
    createGameModal.classList.remove("hidden");
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
    document.getElementById("sb-inning-half").textContent = "TOP";
    document.getElementById("sb-inning-num").textContent = "1";

    // Reset bases and outs
    document.querySelectorAll(".base").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".out-dot").forEach(d => d.classList.remove("active"));

    showScreen(gameScreen);
    await loadLineups();
});

backDashboardBtn.addEventListener("click", async () => {
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
let inningHalf = "top"; // "top" = away bats, home pitches

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
    pitchMenu.style.left = (x + 14) + "px";
    pitchMenu.style.top = (y - 14) + "px";
    pitchMenu.classList.remove("hidden");
    // Pin the ball in place at click location
    ballCursor.style.left = x + "px";
    ballCursor.style.top = y + "px";
    ballCursor.style.display = "block";
    ballCursor.classList.add("pinned");
    document.body.style.cursor = "";
}

function hidePitchMenu() {
    pitchMenu.classList.add("hidden");
    ballCursor.classList.remove("pinned");
}

function handlePitchOutcome(outcome) {
    // TODO: wire up to pitch recording logic
    console.log("Pitch outcome:", outcome, "at", pitchClickX, pitchClickY);
}

document.querySelectorAll(".pitch-menu-item").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        handlePitchOutcome(btn.dataset.outcome);
        hidePitchMenu();
    });
});

document.getElementById("pitch-menu-cancel").addEventListener("click", (e) => {
    e.stopPropagation();
    hidePitchMenu();
});

// Click on game screen to show pitch menu
document.addEventListener("mousedown", (e) => {
    if (!pitchMenu.classList.contains("hidden")) return;
    if (gameScreen.classList.contains("hidden")) return;
    if (!e.target.closest("#game-screen")) return;
    if (e.target.closest("button, .lineup-panel, .modal-overlay, .score-bug")) return;

    showPitchMenu(e.clientX, e.clientY);
});

// --- Ball cursor on game screen ---

const ballCursor = document.getElementById("ball-cursor");
const interactiveSelectors = "button, a, input, select, textarea, .lineup-list li, .pos-btn, .modal-overlay, .modal";

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

// --- Init ---

window.addEventListener("pywebviewready", () => {
    loadTeams();
});
