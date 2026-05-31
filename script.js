let score = 0;
let bestScore = localStorage.getItem("bestScore") || 0;
document.getElementById("bestScore").textContent = bestScore;

function updateScore(points) {
    score += points;
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("bestScore", bestScore);
        document.getElementById("bestScore").textContent = bestScore;
    }
}

/* ===== BLUR HELPERS ===== */
const logo     = document.querySelector(".logo-container");
const menu     = document.querySelector(".menu-buttons");
const controls = document.querySelector(".controls-box");
const icons    = document.querySelector(".top-icons");
const scoreBox = document.querySelector(".high-score-box");

function blurBG() {
    [logo, menu, controls, icons, scoreBox].forEach(el => {
        if (el) el.style.filter = "blur(6px)";
    });
}
function unblurBG() {
    [logo, menu, controls, icons, scoreBox].forEach(el => {
        if (el) el.style.filter = "none";
    });
}

/* ===== PLAY BUTTON ===== */
const playBtn   = document.querySelector(".play-btn");
const mapScreen = document.getElementById("mapScreen");

if (playBtn && mapScreen) {
    playBtn.addEventListener("click", () => {
        mapScreen.classList.add("active");
        blurBG();
    });
}

/* ===== CLOSE MAP ON OUTSIDE CLICK ===== */
document.addEventListener("click", (e) => {
    if (mapScreen && mapScreen.classList.contains("active") &&
        !e.target.closest(".map-popup") &&
        !e.target.closest(".play-btn")) {
        mapScreen.classList.remove("active");
        unblurBG();
    }
});

const closeGameBtn = document.querySelector(".close-game-btn");
if (closeGameBtn) {
    closeGameBtn.addEventListener("click", () => {
        window.close();
        // Fallback if window.close() is blocked
        document.body.innerHTML = `
            <div style="
                display:flex; flex-direction:column;
                justify-content:center; align-items:center;
                height:100vh; background:#000; color:white;
                font-family:'Poppins',sans-serif; gap:20px;
            ">
                <div style="font-size:48px;">✕</div>
                <div style="font-size:24px; color:#ff3333;">You can now close this tab.</div>
                <div style="font-size:14px; color:#888;">Press Enter to close</div>
            </div>
        `;
    });
}
/* ===== MAP BUTTONS ===== */
const finiteBtn   = document.querySelector(".finite-btn");
const infiniteBtn = document.querySelector(".infinite-btn");
if (finiteBtn)   finiteBtn.addEventListener("click",   () => { window.location.href = "finite.html"; });
if (infiniteBtn) infiniteBtn.addEventListener("click", () => { window.location.href = "infinite.html"; });


const keyControls = {
    up:    localStorage.getItem("key_up")    || "w",
    down:  localStorage.getItem("key_down")  || "s",
    left:  localStorage.getItem("key_left")  || "a",
    right: localStorage.getItem("key_right") || "d"
};

function setupKeyChange(buttonId, direction) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    const saved = localStorage.getItem("key_" + direction);
    if (saved) btn.textContent = saved.toUpperCase();

    btn.addEventListener("click", () => {
        btn.textContent = "...";
        function changeKey(e) {
            keyControls[direction] = e.key;
            btn.textContent = e.key.toUpperCase();
            localStorage.setItem("key_" + direction, e.key); // ← save it
            document.removeEventListener("keydown", changeKey);
        }
        document.addEventListener("keydown", changeKey);
    });
}
setupKeyChange("upKey",    "up");
setupKeyChange("downKey",  "down");
setupKeyChange("leftKey",  "left");
setupKeyChange("rightKey", "right");

/* ===== MULTIPLAYER BUTTON ===== */
const multiplayerBtn = document.querySelector(".multiplayer-btn");
if (multiplayerBtn) {
    multiplayerBtn.addEventListener("click", () => {
        window.location.href = "multiplayer.html";
    });
}

/* ===== HELP POPUP ===== */
const helpBtn    = document.getElementById("helpBtn");
const helpScreen = document.getElementById("helpScreen");
const closeHelp  = document.getElementById("closeHelp");

if (helpBtn && helpScreen && closeHelp) {
    helpBtn.addEventListener("click", () => {
        helpScreen.classList.add("active");
        blurBG();
    });
    closeHelp.addEventListener("click", () => {
        helpScreen.classList.remove("active");
        unblurBG();
    });
    helpScreen.addEventListener("click", (e) => {
        if (e.target === helpScreen) {
            helpScreen.classList.remove("active");
            unblurBG();
        }
    });
}

/* ===== LEADERBOARD DATA ===== */
const fakePlayersMP = [
    { name: "ShadowKing",   score: 3850 },
    { name: "NeonBlaze",    score: 3620 },
    { name: "VoidSlayer",   score: 3410 },
    { name: "CryptoNinja",  score: 3280 },
    { name: "PhantomX",     score: 3100 },
    { name: "DarkMatter",   score: 2940 },
    { name: "GhostRifle",   score: 2780 },
    { name: "StormBringer", score: 2550 },
    { name: "IronFang",     score: 2390 },
    { name: "AshBolt",      score: 2210 },
];

// "You" — insert at rank 14 (not in top 10)
const yourName  = "You";
const yourScore = parseInt(localStorage.getItem("bestScore")) || 0;

function buildLeaderboard() {
    // Combine fake + player, sort descending
    const all = [...fakePlayersMP, { name: yourName, score: yourScore }];
    all.sort((a, b) => b.score - a.score);

    const yourRank = all.findIndex(p => p.name === yourName) + 1;
    const top10    = all.slice(0, 10);
    const inTop10  = yourRank <= 10;

    const list = document.getElementById("leaderboardList");
    if (!list) return;
    list.innerHTML = "";

    const medals = ["🥇", "🥈", "🥉"];

    top10.forEach((p, i) => {
        const rank    = i + 1;
        const isYou   = p.name === yourName;
        const medal   = medals[i] || "";
        const row     = document.createElement("div");
        row.className = "lb-row" + (isYou ? " lb-you" : "");
        row.innerHTML = `
            <span class="lb-rank">${medal || "#" + rank}</span>
            <span class="lb-name">${p.name}</span>
            <span class="lb-score">${p.score.toLocaleString()}</span>
        `;
        list.appendChild(row);
    });

    // If player not in top 10, show separator + their row
    if (!inTop10) {
        const sep = document.createElement("div");
        sep.className = "lb-separator";
        sep.textContent = "• • •";
        list.appendChild(sep);

        const youRow = document.createElement("div");
        youRow.className = "lb-row lb-you";
        youRow.innerHTML = `
            <span class="lb-rank">#${yourRank}</span>
            <span class="lb-name">${yourName}</span>
            <span class="lb-score">${yourScore.toLocaleString()}</span>
        `;
        list.appendChild(youRow);
    }
}

/* ===== TROPHY / LEADERBOARD POPUP ===== */
const trophyBtn = document.getElementById("trophyBtn");
const leaderboardScreen = document.getElementById("leaderboardScreen");
const closeLeaderboard  = document.getElementById("closeLeaderboard");
    
if (trophyBtn && leaderboardScreen && closeLeaderboard) {
    trophyBtn.addEventListener("click", () => {
        buildLeaderboard();
        leaderboardScreen.classList.add("active");
        blurBG();
    });
    closeLeaderboard.addEventListener("click", () => {
        leaderboardScreen.classList.remove("active");
        unblurBG();
    });
    leaderboardScreen.addEventListener("click", (e) => {
        if (e.target === leaderboardScreen) {
            leaderboardScreen.classList.remove("active");
            unblurBG();
        }
    });
}