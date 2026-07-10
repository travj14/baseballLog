// --- Autosave ---
let autosaveEnabled = localStorage.getItem("autosave") === "true";
const autosaveToggle = document.getElementById("autosave-toggle");

function updateAutosaveButton() {
    if (autosaveEnabled) {
        autosaveToggle.textContent = "Autosave: ON";
        autosaveToggle.className = "autosave-btn on";
    } else {
        autosaveToggle.textContent = "Autosave: OFF";
        autosaveToggle.className = "autosave-btn off";
    }
}
updateAutosaveButton();

autosaveToggle.addEventListener("click", () => {
    autosaveEnabled = !autosaveEnabled;
    localStorage.setItem("autosave", autosaveEnabled);
    updateAutosaveButton();
});

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
            // Keep the full game (pitches/baserunning/pitch_counts) from the
            // backend, but carry over the resolved opponent name for display.
            result.opponent = game.opponent;
            selectedGame = result;
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

// --- Analysis Screen ---
const analysisScreen = document.getElementById("analysis-screen");
const analysisGameFilter = document.getElementById("analysis-game-filter");
const analysisScopeFilter = document.getElementById("analysis-scope-filter");
const analysisPlayerFilter = document.getElementById("analysis-player-filter");
const battingStatsBody = document.getElementById("batting-stats-body");
const battingStatsFoot = document.getElementById("batting-stats-foot");
const analysisEmpty = document.getElementById("analysis-empty");
const SVG_NS = "http://www.w3.org/2000/svg";

const COUNTING_COLS = ["PA", "AB", "H", "1B", "2B", "3B", "HR", "BB", "HBP", "SO", "SF", "SH", "TB"];
const RATE_COLS = ["AVG", "OBP", "SLG", "OPS", "wOBA"];

// Baseball convention: rate stats below 1 drop the leading zero (".333").
function formatRate(value) {
    const v = Number(value) || 0;
    const s = v.toFixed(3);
    return v < 1 && v >= 0 ? s.replace(/^0/, "") : s;
}

function statCell(text, extraClass) {
    const td = document.createElement("td");
    td.textContent = text;
    if (extraClass) td.className = extraClass;
    return td;
}

function makeStatRow(row, isTotal) {
    const tr = document.createElement("tr");
    if (isTotal) tr.className = "stats-total-row";

    const nameTd = document.createElement("td");
    nameTd.className = "sticky-col";
    if (isTotal) {
        nameTd.textContent = "Team totals";
    } else {
        const num = row.number ? `#${row.number} ` : "";
        nameTd.textContent = `${num}${row.name}`;
    }
    tr.appendChild(nameTd);

    COUNTING_COLS.forEach(col => tr.appendChild(statCell(row[col] ?? 0)));
    RATE_COLS.forEach(col => tr.appendChild(statCell(formatRate(row[col]), "rate")));
    return tr;
}

function computeTotals(rows) {
    const totals = {};
    COUNTING_COLS.forEach(col => { totals[col] = 0; });
    rows.forEach(r => COUNTING_COLS.forEach(col => { totals[col] += r[col] || 0; }));

    const ab = totals.AB, h = totals.H, bb = totals.BB, hbp = totals.HBP, sf = totals.SF;
    const onBaseDen = ab + bb + hbp + sf;
    totals.AVG = ab ? h / ab : 0;
    totals.OBP = onBaseDen ? (h + bb + hbp) / onBaseDen : 0;
    totals.SLG = ab ? totals.TB / ab : 0;
    totals.OPS = totals.OBP + totals.SLG;
    // wOBA totals use the same weights as the backend (stats.py WOBA_WEIGHTS).
    const w = { BB: 0.69, HBP: 0.72, "1B": 0.89, "2B": 1.27, "3B": 1.62, HR: 2.10 };
    const wobaNum = w.BB * bb + w.HBP * hbp + w["1B"] * totals["1B"]
        + w["2B"] * totals["2B"] + w["3B"] * totals["3B"] + w.HR * totals.HR;
    totals.wOBA = onBaseDen ? wobaNum / onBaseDen : 0;
    return totals;
}

// ===== Charts =====

function svgNode(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
}

// Categorical color slots (identity encoding), assigned in fixed order. Values
// come from CSS custom properties on .charts-grid so light/dark swap in one
// place; hardcoded values are a fallback.
function seriesColor(idx) {
    const root = document.querySelector(".charts-grid");
    const fallback = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948"];
    if (!root) return fallback[idx] || "#888";
    const v = getComputedStyle(root).getPropertyValue(`--series-${idx + 1}`).trim();
    return v || fallback[idx] || "#888";
}

function chromeColor(name, fallback) {
    const root = document.querySelector(".charts-grid");
    if (!root) return fallback;
    const v = getComputedStyle(root).getPropertyValue(name).trim();
    return v || fallback;
}

const PITCH_CATEGORIES = ["Ball", "Strike", "Foul", "In play"];

function pitchCategory(ev) {
    const o = ev.outcome;
    if (o === "ball" || o === "walk" || o === "hbp") return "Ball";
    if (o === "strike" || o === "strikeout") return "Strike";
    if (o === "foul") return "Foul";
    return "In play";  // single/double/triple/home_run/out/error
}

const SPRAY_CATEGORIES = ["Single", "Double", "Triple", "Home Run", "Out", "Error"];

// --- Chart tooltip ---
const chartTooltip = document.getElementById("chart-tooltip");

function attachTooltip(node, text) {
    node.addEventListener("mousemove", (e) => {
        chartTooltip.textContent = text;
        chartTooltip.style.left = (e.clientX + 12) + "px";
        chartTooltip.style.top = (e.clientY + 12) + "px";
        chartTooltip.classList.remove("hidden");
    });
    node.addEventListener("mouseleave", () => chartTooltip.classList.add("hidden"));
}

function renderLegend(el, categories, present) {
    el.innerHTML = "";
    categories.forEach((cat, i) => {
        if (present && !present.has(cat)) return;
        const chip = document.createElement("span");
        chip.className = "legend-chip";
        const dot = document.createElement("span");
        dot.className = "legend-dot";
        dot.style.background = seriesColor(i);
        const label = document.createElement("span");
        label.textContent = cat;
        chip.appendChild(dot);
        chip.appendChild(label);
        el.appendChild(chip);
    });
}

function renderPitchMap(events) {
    const svg = document.getElementById("pitch-map");
    const empty = document.getElementById("pitch-map-empty");
    svg.innerHTML = "";

    const grid = chromeColor("--grid", "#e1e0d9");
    const axis = chromeColor("--axis", "#c3c2b7");
    const surface = chromeColor("--surface-1", "#fcfcfb");

    // Strike zone box within the 240x260 plot.
    const zx = 70, zy = 60, zw = 100, zh = 100;
    svg.appendChild(svgNode("rect", {
        x: zx, y: zy, width: zw, height: zh, fill: "none",
        stroke: axis, "stroke-width": 1.2, rx: 2,
    }));
    // 3x3 interior grid.
    for (let i = 1; i < 3; i++) {
        svg.appendChild(svgNode("line", {
            x1: zx + (zw / 3) * i, y1: zy, x2: zx + (zw / 3) * i, y2: zy + zh,
            stroke: grid, "stroke-width": 1,
        }));
        svg.appendChild(svgNode("line", {
            x1: zx, y1: zy + (zh / 3) * i, x2: zx + zw, y2: zy + (zh / 3) * i,
            stroke: grid, "stroke-width": 1,
        }));
    }

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const located = events.filter(e => e.zone_x != null && e.zone_y != null);
    const present = new Set();

    located.forEach(e => {
        const cat = pitchCategory(e);
        present.add(cat);
        const idx = PITCH_CATEGORIES.indexOf(cat);
        const px = clamp(zx + e.zone_x * zw, 16, 224);
        const py = clamp(zy + e.zone_y * zh, 16, 244);
        const dot = svgNode("circle", {
            cx: px, cy: py, r: 4.5,
            fill: seriesColor(idx),
            stroke: surface, "stroke-width": 2,
        });
        const detail = e.hit_result ? ` (${e.hit_result})` : "";
        attachTooltip(dot, `${e.batter_name}: ${cat}${detail}`);
        svg.appendChild(dot);
    });

    empty.classList.toggle("hidden", located.length > 0);
    renderLegend(document.getElementById("pitch-map-legend"), PITCH_CATEGORIES, present);
}

// Recessive baseball-field guide, drawn to fill a square viewBox of side `s`.
// Home plate at bottom center; foul lines leave home at a true 45° and the
// infield bases sit exactly on those lines; fence arc spans the foul poles.
function drawFieldGuide(svg, s) {
    const grid = chromeColor("--grid", "#e1e0d9");
    const axis = chromeColor("--axis", "#c3c2b7");
    const home = { x: s * 0.5, y: s * 0.86 };
    const b = s * 0.14;  // diamond half-diagonal
    const first = { x: home.x + b, y: home.y - b };
    const second = { x: home.x, y: home.y - 2 * b };
    const third = { x: home.x - b, y: home.y - b };
    // Foul poles: extend the 45° foul lines out toward the corners.
    const rp = { x: s * 0.94, y: s * 0.42 };
    const lp = { x: s * 0.06, y: s * 0.42 };
    svg.appendChild(svgNode("line", { x1: home.x, y1: home.y, x2: lp.x, y2: lp.y, stroke: axis, "stroke-width": 1.2 }));
    svg.appendChild(svgNode("line", { x1: home.x, y1: home.y, x2: rp.x, y2: rp.y, stroke: axis, "stroke-width": 1.2 }));
    // Outfield fence arc between the foul poles.
    svg.appendChild(svgNode("path", {
        d: `M ${lp.x} ${lp.y} Q ${home.x} ${s * -0.12} ${rp.x} ${rp.y}`,
        fill: "none", stroke: grid, "stroke-width": 1,
    }));
    // Infield diamond (first & third fall on the foul lines).
    svg.appendChild(svgNode("path", {
        d: `M ${home.x} ${home.y} L ${first.x} ${first.y} L ${second.x} ${second.y} L ${third.x} ${third.y} Z`,
        fill: "none", stroke: grid, "stroke-width": 1,
    }));
}

function renderSprayChart(events) {
    const svg = document.getElementById("spray-chart");
    const empty = document.getElementById("spray-empty");
    svg.innerHTML = "";
    const S = 220;
    drawFieldGuide(svg, S);

    const surface = chromeColor("--surface-1", "#fcfcfb");
    const located = events.filter(e => e.batted_ball_x != null && e.batted_ball_y != null && e.hit_result);
    const present = new Set();

    located.forEach(e => {
        const idx = SPRAY_CATEGORIES.indexOf(e.hit_result);
        if (idx === -1) return;
        present.add(e.hit_result);
        const dot = svgNode("circle", {
            cx: e.batted_ball_x * S, cy: e.batted_ball_y * S, r: 4.5,
            fill: seriesColor(idx),
            stroke: surface, "stroke-width": 2,
        });
        const type = e.hit_type ? `, ${e.hit_type}` : "";
        attachTooltip(dot, `${e.batter_name}: ${e.hit_result}${type}`);
        svg.appendChild(dot);
    });

    empty.classList.toggle("hidden", located.length > 0);
    renderLegend(document.getElementById("spray-legend"), SPRAY_CATEGORIES, present);
}

function populatePlayerFilter(allRows) {
    const desired = analysisPlayerFilter.value;
    analysisPlayerFilter.innerHTML = '<option value="">All batters</option>';
    allRows.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.player_id;
        const num = r.number ? `#${r.number} ` : "";
        opt.textContent = `${num}${r.name}`;
        analysisPlayerFilter.appendChild(opt);
    });
    // Preserve the selection if it still exists.
    analysisPlayerFilter.value =
        [...analysisPlayerFilter.options].some(o => o.value === desired) ? desired : "";
}

async function loadSeason() {
    const summary = await window.pywebview.api.get_season_summary();
    const body = document.getElementById("game-log-body");
    body.innerHTML = "";
    if (!summary || summary.error) return;

    const rec = summary.record;
    const recordText = rec.ties
        ? `${rec.wins}-${rec.losses}-${rec.ties}` : `${rec.wins}-${rec.losses}`;
    document.getElementById("season-record").textContent = recordText;
    document.getElementById("season-rf").textContent = rec.runs_for;
    document.getElementById("season-ra").textContent = rec.runs_against;
    const diff = rec.run_diff;
    document.getElementById("season-diff").textContent = diff > 0 ? `+${diff}` : `${diff}`;
    document.getElementById("season-gp").textContent = rec.games_played;

    const games = summary.games || [];
    document.getElementById("season-empty").classList.toggle("hidden", games.length > 0);

    games.forEach(g => {
        const tr = document.createElement("tr");
        const prefix = g.home_away === "away" ? "@ " : "vs ";
        const nameTd = document.createElement("td");
        nameTd.className = "sticky-col";
        nameTd.textContent = `${prefix}${g.opponent}`;
        tr.appendChild(nameTd);

        const resTd = document.createElement("td");
        resTd.textContent = g.result || "—";
        if (g.result === "W") resTd.className = "result-w";
        else if (g.result === "L") resTd.className = "result-l";
        tr.appendChild(resTd);

        const scoreTd = document.createElement("td");
        scoreTd.textContent = `${g.my_score}-${g.opp_score}`;
        tr.appendChild(scoreTd);

        const statusTd = document.createElement("td");
        statusTd.textContent = g.status;
        tr.appendChild(statusTd);

        body.appendChild(tr);
    });
}

async function loadAnalysis() {
    const gameId = analysisGameFilter.value || null;
    const scope = analysisScopeFilter.value || "my_team";
    const allRows = await window.pywebview.api.get_batting_stats(gameId, scope);

    battingStatsBody.innerHTML = "";
    battingStatsFoot.innerHTML = "";

    const rowsOk = Array.isArray(allRows) && allRows.length > 0;
    populatePlayerFilter(rowsOk ? allRows : []);
    const playerId = analysisPlayerFilter.value || null;

    if (!rowsOk) {
        analysisEmpty.classList.remove("hidden");
        renderPitchMap([]);
        renderSprayChart([]);
        return;
    }
    analysisEmpty.classList.add("hidden");

    const rows = playerId ? allRows.filter(r => r.player_id === playerId) : allRows;
    rows.forEach(row => battingStatsBody.appendChild(makeStatRow(row, false)));
    battingStatsFoot.appendChild(makeStatRow(computeTotals(rows), true));

    const events = await window.pywebview.api.get_pitch_events(gameId, scope, playerId);
    const evList = Array.isArray(events) ? events : [];
    renderPitchMap(evList);
    renderSprayChart(evList);
}

async function populateGameFilter() {
    const rosterTeams = await window.pywebview.api.get_roster_teams();
    const teamMap = {};
    (rosterTeams || []).forEach(t => { teamMap[t.id] = t.team_name; });

    const games = await window.pywebview.api.get_games();
    analysisGameFilter.innerHTML = '<option value="">All games</option>';
    (games || []).forEach(g => {
        const opp = teamMap[g.opponent_id] || g.opponent_id;
        const prefix = g.home_away === "away" ? "@ " : "vs ";
        const opt = document.createElement("option");
        opt.value = g.id;
        opt.textContent = `${prefix}${opp} (${g.home_score}-${g.away_score})`;
        analysisGameFilter.appendChild(opt);
    });
}

document.getElementById("analyze-btn").addEventListener("click", async () => {
    showScreen(analysisScreen);
    await populateGameFilter();
    await loadSeason();
    await loadAnalysis();
});

analysisGameFilter.addEventListener("change", loadAnalysis);
analysisScopeFilter.addEventListener("change", loadAnalysis);
analysisPlayerFilter.addEventListener("change", loadAnalysis);

async function runExport(apiCall) {
    const gameId = analysisGameFilter.value || null;
    const scope = analysisScopeFilter.value || "my_team";
    const result = await apiCall(gameId, scope);
    if (result && result.path) {
        showToast(`Exported to ${result.path}`);
    } else if (result && result.error) {
        showToast(result.error);
    }
}

document.getElementById("export-csv-btn").addEventListener("click", () =>
    runExport((g, s) => window.pywebview.api.export_batting_csv(g, s)));
document.getElementById("export-html-btn").addEventListener("click", () =>
    runExport((g, s) => window.pywebview.api.export_html_summary(g, s)));

document.getElementById("export-game-btn").addEventListener("click", async () => {
    const gameId = analysisGameFilter.value || null;
    if (!gameId) { showToast("Pick a specific game to export its summary."); return; }
    const result = await window.pywebview.api.export_game_summary(gameId);
    if (result && result.path) showToast(`Exported to ${result.path}`);
    else if (result && result.error) showToast(result.error);
});
document.getElementById("export-season-btn").addEventListener("click", async () => {
    const result = await window.pywebview.api.export_season_csv();
    if (result && result.path) showToast(`Exported to ${result.path}`);
    else if (result && result.error) showToast(result.error);
});

document.getElementById("back-dashboard-from-analysis-btn").addEventListener("click", () => {
    showScreen(dashboardScreen);
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
const endGameBtn = document.getElementById("end-game-btn");
const unsavedModal = document.getElementById("unsaved-modal");
const endGameModal = document.getElementById("end-game-modal");
let pendingLeaveAction = null;

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
    pitchCounts = selectedGame.pitch_counts || {};

    // Undo bookkeeping for this session.
    const pitchesArr = selectedGame.pitches || [];
    recordedPitches = pitchesArr.length;
    recordedBaserunning = (selectedGame.baserunning || []).length;
    lastPitchId = pitchesArr.length ? pitchesArr[pitchesArr.length - 1].id : null;
    undoStack = [];
    updateUndoButton();
    currentPitchType = "";
    document.getElementById("pitch-type-select").value = "";

    updateGameState();
    markSaveClean();

    showScreen(gameScreen);
    await loadLineups();
});

function markSaveDirty() {
    if (autosaveEnabled) {
        saveCurrentGame();
    } else {
        saveGameBtn.className = "save-btn save-dirty";
        saveGameBtn.textContent = "Save";
    }
}

function markSaveClean() {
    saveGameBtn.className = "save-btn save-clean";
    saveGameBtn.textContent = autosaveEnabled ? "Autosaving" : "Save";
}

function isSaveDirty() {
    return saveGameBtn.classList.contains("save-dirty");
}

async function saveCurrentGame() {
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
}

function leaveGame() {
    hidePitchMenu();
    clearPitchDots();
    document.querySelectorAll(".modal-overlay").forEach(m => m.classList.add("hidden"));
    loadDashboard();
    showScreen(dashboardScreen);
}

function tryLeaveGame(action) {
    if (isSaveDirty()) {
        pendingLeaveAction = action;
        unsavedModal.classList.remove("hidden");
    } else {
        action();
    }
}

saveGameBtn.addEventListener("click", () => saveCurrentGame());

document.getElementById("undo-btn").addEventListener("click", () => undoLastEvent());

const pitchTypeSelect = document.getElementById("pitch-type-select");
pitchTypeSelect.addEventListener("change", () => { currentPitchType = pitchTypeSelect.value; });

backDashboardBtn.addEventListener("click", () => {
    tryLeaveGame(leaveGame);
});

// --- End Game ---
endGameBtn.addEventListener("click", () => {
    endGameModal.classList.remove("hidden");
});

document.getElementById("end-game-confirm-btn").addEventListener("click", async () => {
    await saveCurrentGame();
    await window.pywebview.api.end_game();
    endGameModal.classList.add("hidden");
    leaveGame();
});

document.getElementById("end-game-cancel-btn").addEventListener("click", () => {
    endGameModal.classList.add("hidden");
});

endGameModal.addEventListener("click", (e) => {
    if (e.target === endGameModal) endGameModal.classList.add("hidden");
});

// --- Unsaved Changes Modal ---
document.getElementById("unsaved-save-btn").addEventListener("click", async () => {
    await saveCurrentGame();
    unsavedModal.classList.add("hidden");
    if (pendingLeaveAction) pendingLeaveAction();
    pendingLeaveAction = null;
});

document.getElementById("unsaved-leave-btn").addEventListener("click", () => {
    unsavedModal.classList.add("hidden");
    if (pendingLeaveAction) pendingLeaveAction();
    pendingLeaveAction = null;
});

document.getElementById("unsaved-cancel-btn").addEventListener("click", () => {
    unsavedModal.classList.add("hidden");
    pendingLeaveAction = null;
});

unsavedModal.addEventListener("click", (e) => {
    if (e.target === unsavedModal) {
        unsavedModal.classList.add("hidden");
        pendingLeaveAction = null;
    }
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
let pitchCounts = {};
let undoStack = [];
let recordedPitches = 0;      // mirrors backend game.pitches.length
let recordedBaserunning = 0;  // mirrors backend game.baserunning.length
let toastTimer = null;
let battedBallLoc = null;     // {x, y} normalized field location for a hit, or null
let currentPitchType = "";    // sticky pitch type applied to each pitch until changed

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

    updatePitchCount();
}

function updatePitchCount() {
    const fieldingSide = inningHalf === "top" ? "home" : "away";
    const fieldingLineup = fieldingSide === "home" ? homeLineup : awayLineup;
    const pitcherEntry = fieldingLineup.find(e => e.position === "P");
    const count = pitcherEntry ? (pitchCounts[pitcherEntry.id] || 0) : 0;
    document.getElementById("sb-pitch-count").textContent = count;
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

function placePitchDot(x, y, isBall) {
    const dot = document.createElement("div");
    dot.className = "pitch-dot finalized" + (isBall ? " ball" : "");
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
    document.getElementById("strike-submenu").classList.add("hidden");
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

function isPitchInZone(x, y) {
    const zone = document.querySelector(".strike-zone");
    const rect = zone.getBoundingClientRect();
    const ballRadius = (180 * 2.9 / 17) / 2;
    // Ball overlaps zone if its edge touches the zone rectangle
    return (
        x + ballRadius > rect.left &&
        x - ballRadius < rect.right &&
        y + ballRadius > rect.top &&
        y - ballRadius < rect.bottom
    );
}

// --- Toast (transient user feedback for guardrails) ---

function showToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 2500);
}

// --- Guardrails ---

function canRecordPitch() {
    if (!getCurrentBatterId()) {
        return { ok: false, msg: "Set a batting lineup before recording pitches." };
    }
    if (!getCurrentPitcherId()) {
        return { ok: false, msg: "Assign a pitcher (position P) before recording pitches." };
    }
    return { ok: true };
}

// --- Undo ---

function updateUndoButton() {
    const btn = document.getElementById("undo-btn");
    if (btn) btn.disabled = undoStack.length === 0;
}

function snapshotState() {
    undoStack.push({
        inningNum, inningHalf, balls, strikes, outs,
        bases: { first: bases.first, second: bases.second, third: bases.third },
        homeBatterIdx, awayBatterIdx,
        homeScore: selectedGame.home_score,
        awayScore: selectedGame.away_score,
        recordedPitches, recordedBaserunning,
        pitchCounts: Object.assign({}, pitchCounts),
        lastPitchId,
    });
    updateUndoButton();
}

async function undoLastEvent() {
    if (undoStack.length === 0) return;
    const s = undoStack.pop();

    inningNum = s.inningNum;
    inningHalf = s.inningHalf;
    balls = s.balls;
    strikes = s.strikes;
    outs = s.outs;
    bases = { first: s.bases.first, second: s.bases.second, third: s.bases.third };
    homeBatterIdx = s.homeBatterIdx;
    awayBatterIdx = s.awayBatterIdx;
    selectedGame.home_score = s.homeScore;
    selectedGame.away_score = s.awayScore;
    document.getElementById("sb-home-score").textContent = s.homeScore;
    document.getElementById("sb-away-score").textContent = s.awayScore;
    pitchCounts = Object.assign({}, s.pitchCounts);
    recordedPitches = s.recordedPitches;
    recordedBaserunning = s.recordedBaserunning;
    lastPitchId = s.lastPitchId;

    // Close any in-progress pitch/runner UI so it can't act on stale state.
    hidePitchMenu();
    document.getElementById("runner-resolution").classList.add("hidden");

    // Sync the persisted event logs with the restored live state.
    await window.pywebview.api.undo_last_event(recordedPitches, recordedBaserunning);

    clearPitchDots();
    updateGameState();
    renderLineup("home");
    renderLineup("away");
    updateUndoButton();
    markSaveDirty();
}

// Centralized baserunning recorder so the undo counter stays accurate.
function recordBaserunning(entry) {
    recordedBaserunning++;
    return window.pywebview.api.record_baserunning(entry);
}

// Pitch location normalized to the strike zone: 0..1 across the zone box,
// negative or >1 outside it. Stored so pitch-location maps are reproducible
// (raw loc_x/loc_y are screen pixels tied to the scoring session's layout).
function computeZoneCoords(x, y) {
    const zone = document.querySelector(".strike-zone");
    if (!zone) return { zx: null, zy: null };
    const r = zone.getBoundingClientRect();
    if (!r.width || !r.height) return { zx: null, zy: null };
    return {
        zx: Math.round(((x - r.left) / r.width) * 1000) / 1000,
        zy: Math.round(((y - r.top) / r.height) * 1000) / 1000,
    };
}

function buildPitchData(outcome, hitResult, hitType, strikeType) {
    const zc = computeZoneCoords(pitchClickX, pitchClickY);
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
        zone_x: zc.zx,
        zone_y: zc.zy,
        in_zone: isPitchInZone(pitchClickX, pitchClickY),
        outcome: outcome,
        pitch_type: currentPitchType || null,
        hit_result: hitResult || null,
        hit_type: hitType || null,
        strike_type: strikeType || null,
        batted_ball_x: battedBallLoc ? battedBallLoc.x : null,
        batted_ball_y: battedBallLoc ? battedBallLoc.y : null,
        home_score: selectedGame.home_score,
        away_score: selectedGame.away_score,
    };
}

async function recordPitch(outcome, hitResult, hitType, strikeType) {
    const data = buildPitchData(outcome, hitResult, hitType, strikeType);
    recordedPitches++;  // keep undo counter in sync with backend append
    const pitcherId = data.pitcher_id;
    if (pitcherId) {
        pitchCounts[pitcherId] = (pitchCounts[pitcherId] || 0) + 1;
    }
    updatePitchCount();
    const result = await window.pywebview.api.pitch(data);
    if (result && result.pitch_counts) {
        pitchCounts = result.pitch_counts;
    }
    if (result && result.pitches && result.pitches.length > 0) {
        lastPitchId = result.pitches[result.pitches.length - 1].id;
    }
}

function handlePitchOutcome(outcome, strikeType) {
    snapshotState();
    markSaveDirty();
    placePitchDot(pitchClickX, pitchClickY, outcome === "Ball");
    let atBatOver = false;

    // Snapshot pre-outcome state for pitch data
    const preOutcome = outcome;

    switch (outcome) {
        case "Strike":
            strikes++;
            if (strikes >= 3) {
                recordPitch("strikeout", null, null, strikeType);
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
        recordPitch(outcome.toLowerCase(), null, null, strikeType);
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
        case "Fielder's Choice":
            // Batter reaches; the scorer marks which runner was put out.
            if (startBase === "batter") return "first";
            return startBase;
        case "Sac Fly":
            if (startBase === "batter") return "out_at_first";  // batter out
            if (startBase === "third") return "home";           // runner tags and scores
            return startBase;
        case "Sac Bunt":
            if (startBase === "batter") return "out_at_first";  // batter out
            if (startBase === "third") return "home";
            if (startBase === "second") return "third";
            if (startBase === "first") return "second";
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
    snapshotState();
    markSaveDirty();
    placePitchDot(pitchClickX, pitchClickY);

    const outcomeMap = {
        "Single": "single", "Double": "double", "Triple": "triple",
        "Home Run": "home_run", "Out": "out", "Error": "error",
        "Fielder's Choice": "fielders_choice", "Sac Fly": "sac_fly", "Sac Bunt": "sac_bunt",
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
            recordBaserunning({
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
            recordBaserunning({
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
            recordBaserunning({
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

function showSubmenuNextTo(submenu, anchor) {
    const rect = anchor.getBoundingClientRect();
    let left = rect.right + 2;
    let top = rect.top;
    submenu.style.left = left + "px";
    submenu.style.top = top + "px";
    submenu.classList.remove("hidden");

    const subH = submenu.offsetHeight;
    const subW = submenu.offsetWidth;
    if (top + subH > window.innerHeight) {
        submenu.style.top = (window.innerHeight - subH - 4) + "px";
    }
    if (left + subW > window.innerWidth) {
        submenu.style.left = (rect.left - subW - 2) + "px";
    }
}

const strikeSubmenu = document.getElementById("strike-submenu");

document.querySelectorAll("#pitch-menu .pitch-menu-item").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (btn.dataset.outcome === "Strike") {
            showSubmenuNextTo(strikeSubmenu, pitchMenu);
            return;
        }
        if (btn.dataset.outcome === "Hit") {
            showSubmenuNextTo(hitSubmenu, pitchMenu);
            return;
        }
        hitSubmenu.classList.add("hidden");
        strikeSubmenu.classList.add("hidden");
        handlePitchOutcome(btn.dataset.outcome);
        hidePitchMenu();
    });
});

const hitTypeSubmenu = document.getElementById("hit-type-submenu");
let pendingHitResult = null;

// --- Strike submenu handlers ---
document.querySelectorAll("#strike-submenu .pitch-menu-item").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        handlePitchOutcome("Strike", btn.dataset.striketype);
        hidePitchMenu();
    });
});

document.getElementById("strike-submenu-cancel").addEventListener("click", (e) => {
    e.stopPropagation();
    strikeSubmenu.classList.add("hidden");
});

document.querySelectorAll("#hit-submenu .pitch-menu-item").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        pendingHitResult = btn.dataset.hit;
        showSubmenuNextTo(hitTypeSubmenu, hitSubmenu);
    });
});

document.querySelectorAll("#hit-type-submenu .pitch-menu-item").forEach(btn => {
    btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const hitResult = pendingHitResult;
        const hitType = btn.dataset.hittype;
        hitTypeSubmenu.classList.add("hidden");
        hitSubmenu.classList.add("hidden");
        hidePitchMenu();

        // Optionally capture where the ball was hit (for spray charts).
        battedBallLoc = await pickBattedBallLocation();
        handleHitOutcome(hitResult, hitType);
        battedBallLoc = null;
    });
});

// --- Batted-ball location picker ---

let bbResolve = null;
const battedBallModal = document.getElementById("batted-ball-modal");
const bbField = document.getElementById("bb-field");

function pickBattedBallLocation() {
    return new Promise((resolve) => {
        bbResolve = resolve;
        battedBallModal.classList.remove("hidden");
    });
}

function resolveBattedBall(value) {
    battedBallModal.classList.add("hidden");
    if (bbResolve) {
        bbResolve(value);
        bbResolve = null;
    }
}

if (bbField) {
    drawFieldGuide(bbField, 200);
    bbField.addEventListener("click", (e) => {
        const r = bbField.getBoundingClientRect();
        const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 1000;
        const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 1000;
        resolveBattedBall({ x, y });
    });
    document.getElementById("bb-skip-btn").addEventListener("click", () => resolveBattedBall(null));
    battedBallModal.addEventListener("click", (e) => {
        if (e.target === battedBallModal) resolveBattedBall(null);
    });
}

document.getElementById("pitch-menu-cancel").addEventListener("click", (e) => {
    e.stopPropagation();
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

    const check = canRecordPitch();
    if (!check.ok) {
        showToast(check.msg);
        return;
    }

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
    // Guardrail: don't stack two runners on the same base.
    if (to !== "home" && bases[to]) {
        showToast("That base is already occupied.");
        return;
    }
    snapshotState();
    markSaveDirty();
    const battingSide = inningHalf === "top" ? "away" : "home";
    const runnerId = bases[from];

    // Record baserunning event
    recordBaserunning({
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
    snapshotState();
    markSaveDirty();
    const runnerId = bases[from];

    // Record baserunning event
    recordBaserunning({
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

window.addEventListener("beforeunload", (e) => {
    if (isSaveDirty() && !gameScreen.classList.contains("hidden")) {
        e.preventDefault();
        e.returnValue = "";
    }
});
