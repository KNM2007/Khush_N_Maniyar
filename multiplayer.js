const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

/* ================= MAP SETTINGS ================= */

const ROWS = 4;
const COLS = 8;
const DOOR_SIZE = 50;
const WALL_T = 5;
const MARGIN = 40;

let ROOM_SIZE, GAP, START_X, START_Y;

function calcLayout() {
    const totalW = canvas.width - MARGIN * 2;
    const totalH = canvas.height - MARGIN * 2;
    ROOM_SIZE = Math.floor(Math.min(
        totalW / (COLS + (COLS - 1) * 0.4),
        totalH / (ROWS + (ROWS - 1) * 0.4)
    ));
    GAP = Math.floor(ROOM_SIZE * 0.4);
    const gridW = COLS * ROOM_SIZE + (COLS - 1) * GAP;
    const gridH = ROWS * ROOM_SIZE + (ROWS - 1) * GAP;
    START_X = Math.floor((canvas.width - gridW) / 2);
    START_Y = Math.floor((canvas.height - gridH) / 2);
}

/* ================= BACKGROUND IMAGE ================= */

const bgImage = new Image();
bgImage.src = "map.png";

/* ================= SOUND ================= */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(type, freqStart, freqEnd, gainVal, duration) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const playShootSound    = () => playTone("square",   440, 80,  0.3, 0.15);
const playHitSound      = () => playTone("sawtooth", 200, 40,  0.4, 0.20);
const playKillSound     = () => playTone("sine",     600, 300, 0.5, 0.30);
const playPlayerHitSound= () => playTone("square",   100, 60,  0.5, 0.25);
const playCollectSound  = () => playTone("sine",     300, 600, 0.4, 0.20);

/* ================= PLAYERS ================= */

const players = [
    {
        id: 0, x: 0, y: 0,
        radius: 12, speed: 4, health: 100,
        score: 0,
        color: "#FFD700", strokeColor: "#FF8C00",
        label: "P1",
        controls: { up: "w", down: "s", left: "a", right: "d" },
        bullets: [],
        lastShot: 0,
        shootCooldown: 300
    },
    {
        id: 1, x: 0, y: 0,
        radius: 12, speed: 4, health: 100,
        score: 0,
        color: "#00CFFF", strokeColor: "#0070AA",
        label: "P2",
        controls: { up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright" },
        bullets: [],
        lastShot: 0,
        shootCooldown: 300
    }
];

/* ================= INPUT ================= */

const keys = {};
window.addEventListener("keydown", e => {
    keys[e.key.toLowerCase()] = true;
    e.preventDefault(); // prevent arrow keys scrolling
});
window.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
});

/* ================= MOUSE / TOUCH AIM ================= */
// P1 aims with mouse, P2 aims with a separate touch point or auto-aims to nearest enemy

let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;

// P2 auto-aim: finds nearest alive enemy room center
function getP2AimAngle() {
    const p = players[1];
    let best = null, bestDist = Infinity;
    for (const room of rooms) {
        if (room.dead) continue;
        const ex = room.x + room.enemyX;
        const ey = room.y + room.enemyY;
        const d = Math.hypot(ex - p.x, ey - p.y);
        if (d < bestDist) { bestDist = d; best = { ex, ey }; }
    }
    if (!best) return 0;
    return Math.atan2(best.ey - p.y, best.ex - p.x);
}

canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

/* ================= ROOMS ================= */

const rooms = [];

function buildWallSegs(room) {
    const { x, y } = room;
    const R = ROOM_SIZE;
    const D = DOOR_SIZE;
    const half = D / 2;
    const segs = [];

    function h(x1, x2, fy) { if (x2 > x1) segs.push({ x1, y1: fy, x2, y2: fy, horiz: true }); }
    function v(y1, y2, fx) { if (y2 > y1) segs.push({ x1: fx, y1, x2: fx, y2, horiz: false }); }

    const side = (room.row + room.col) % 4;

    if (side === 0) { const c = x + ROOM_SIZE / 2; h(x, c - half, y); h(c + half, x + R, y); }
    else { h(x, x + R, y); }

    if (side === 1) { const c = y + ROOM_SIZE / 2; v(y, c - half, x + R); v(c + half, y + R, x + R); }
    else { v(y, y + R, x + R); }

    if (side === 2) { const c = x + ROOM_SIZE / 2; h(x, c - half, y + R); h(c + half, x + R, y + R); }
    else { h(x, x + R, y + R); }

    if (side === 3) { const c = y + ROOM_SIZE / 2; v(y, c - half, x); v(c + half, y + R, x); }
    else { v(y, y + R, x); }

    return segs;
}

function createRooms() {
    rooms.length = 0;
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const room = {
                row, col,
                x: START_X + col * (ROOM_SIZE + GAP),
                y: START_Y + row * (ROOM_SIZE + GAP),
                health: 100,
                dead: false,
                activeP: [false, false], // active[0] = P1 inside, active[1] = P2 inside
                enemyX: 30 + Math.random() * (ROOM_SIZE - 60),
                enemyY: 30 + Math.random() * (ROOM_SIZE - 60),
                killedBy: -1  // which player killed this enemy
            };
            room.walls = buildWallSegs(room);
            rooms.push(room);
        }
    }
}

calcLayout();
createRooms();

// Spawn players on opposite sides
players[0].x = START_X - 30;
players[0].y = START_Y + (ROWS * ROOM_SIZE + (ROWS - 1) * GAP) / 2;
players[1].x = START_X + COLS * ROOM_SIZE + (COLS - 1) * GAP + 30;
players[1].y = START_Y + (ROWS * ROOM_SIZE + (ROWS - 1) * GAP) / 2;

setTimeout(spawnFruit, 1000);

const enemyBullets = [];

/* ================= COLLISION HELPERS ================= */

function closestPtOnSeg(cx, cy, seg) {
    const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return { x: seg.x1, y: seg.y1 };
    const t = Math.max(0, Math.min(1, ((cx - seg.x1) * dx + (cy - seg.y1) * dy) / len2));
    return { x: seg.x1 + t * dx, y: seg.y1 + t * dy };
}

function circleHitsSeg(cx, cy, r, seg) {
    const p = closestPtOnSeg(cx, cy, seg);
    const dx = cx - p.x, dy = cy - p.y;
    return dx * dx + dy * dy < r * r;
}

function pushOut(cx, cy, r, seg) {
    const p = closestPtOnSeg(cx, cy, seg);
    const dx = cx - p.x, dy = cy - p.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    if (dist < r) { const overlap = r - dist; cx += (dx / dist) * overlap; cy += (dy / dist) * overlap; }
    return { x: cx, y: cy };
}

function getAllWalls() {
    const w = [];
    for (const room of rooms) w.push(...room.walls);
    return w;
}

/* ================= PLAYER MOVEMENT ================= */

function movePlayer(p) {
    const c = p.controls;
    let dx = 0, dy = 0;
    if (keys[c.up])    dy -= p.speed;
    if (keys[c.down])  dy += p.speed;
    if (keys[c.left])  dx -= p.speed;
    if (keys[c.right]) dx += p.speed;
    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

    let nx = p.x + dx;
    let ny = p.y + dy;

    const walls = getAllWalls();
    for (let iter = 0; iter < 4; iter++) {
        for (const seg of walls) {
            if (circleHitsSeg(nx, ny, p.radius, seg)) {
                const res = pushOut(nx, ny, p.radius, seg);
                nx = res.x; ny = res.y;
            }
        }
    }

    nx = Math.max(p.radius, Math.min(canvas.width - p.radius, nx));
    ny = Math.max(p.radius, Math.min(canvas.height - p.radius, ny));
    p.x = nx;
    p.y = ny;

    for (const room of rooms) {
        if (room.dead) continue;
        room.activeP[p.id] = (p.x > room.x && p.x < room.x + ROOM_SIZE &&
                              p.y > room.y && p.y < room.y + ROOM_SIZE);
    }
}

/* ================= SHOOT ================= */

// P2 shoots with spacebar (aimed at nearest enemy), with cooldown
const P2_SHOOT_COOLDOWN = 300; // ms
let p2LastShot = 0;

window.addEventListener("keydown", e => {
    if (e.code === "Space") {
        e.preventDefault();
        const now = performance.now();
        const p2 = players[1];
        if (gameOver || p2.health <= 0) return;
        if (now - p2LastShot < P2_SHOOT_COOLDOWN) return;
        p2LastShot = now;
        if (audioCtx.state === "suspended") audioCtx.resume();
        const angle = getP2AimAngle();
        p2.bullets.push({ x: p2.x, y: p2.y, dx: Math.cos(angle), dy: Math.sin(angle), speed: 8, radius: 4, bounces: 4, ownerId: 1 });
        playShootSound();
    }
});

// P1 shoots on click
canvas.addEventListener("click", () => {
    if (gameOver) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    const p1 = players[0];
    if (p1.health <= 0) return;
    const angle = Math.atan2(mouseY - p1.y, mouseX - p1.x);
    p1.bullets.push({ x: p1.x, y: p1.y, dx: Math.cos(angle), dy: Math.sin(angle), speed: 8, radius: 4, bounces: 4, ownerId: 0 });
    playShootSound();
});

/* ================= ROOM DRAWING ================= */

function drawRoom(room) {
    if (room.dead) {
        ctx.fillStyle = "#1a2a1a";
        ctx.fillRect(room.x, room.y, ROOM_SIZE, ROOM_SIZE);
    } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(room.x, room.y, ROOM_SIZE, ROOM_SIZE);
        ctx.clip();
        if (bgImage.complete && bgImage.naturalWidth !== 0) {
            ctx.drawImage(bgImage, room.x, room.y, ROOM_SIZE, ROOM_SIZE);
        } else {
            ctx.fillStyle = "#2a1a3a";
            ctx.fillRect(room.x, room.y, ROOM_SIZE, ROOM_SIZE);
        }
        ctx.restore();
    }

    ctx.lineWidth = WALL_T;
    ctx.strokeStyle = "#222";
    ctx.lineCap = "square";
    for (const seg of room.walls) {
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
    }
    drawDoors(room);
}

function drawDoors(room) {
    ctx.fillStyle = "#ffb300";
    const side = (room.row + room.col) % 4;
    if (side === 0) ctx.fillRect(room.x + ROOM_SIZE / 2 - DOOR_SIZE / 2, room.y - 4, DOOR_SIZE, 8);
    if (side === 1) ctx.fillRect(room.x + ROOM_SIZE - 4, room.y + ROOM_SIZE / 2 - DOOR_SIZE / 2, 8, DOOR_SIZE);
    if (side === 2) ctx.fillRect(room.x + ROOM_SIZE / 2 - DOOR_SIZE / 2, room.y + ROOM_SIZE - 4, DOOR_SIZE, 8);
    if (side === 3) ctx.fillRect(room.x - 4, room.y + ROOM_SIZE / 2 - DOOR_SIZE / 2, 8, DOOR_SIZE);
}

/* ================= ENEMY SHOOT ================= */

setInterval(() => {
    for (const room of rooms) {
        if (room.dead) continue;
        const anyActive = room.activeP[0] || room.activeP[1];
        if (!anyActive) continue;
        const enemyX = room.x + room.enemyX;
        const enemyY = room.y + room.enemyY;

        // Shoot at the closest living player
        let target = null, bestDist = Infinity;
        for (const p of players) {
            if (p.health <= 0) continue;
            const d = Math.hypot(p.x - enemyX, p.y - enemyY);
            if (d < bestDist) { bestDist = d; target = p; }
        }
        if (!target) continue;

        const angle = Math.atan2(target.y - enemyY, target.x - enemyX);
        enemyBullets.push({ x: enemyX, y: enemyY, dx: Math.cos(angle), dy: Math.sin(angle), speed: 5, radius: 4, bounces: 3 });
    }
}, 1500);

/* ================= ENEMIES ================= */

function drawEnemies() {
    for (const room of rooms) {
        if (room.dead) continue;
        const ex = room.x + room.enemyX;
        const ey = room.y + room.enemyY;

        ctx.beginPath();
        ctx.arc(ex, ey, 12, 0, Math.PI * 2);
        ctx.fillStyle = "red";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "black";
        ctx.stroke();

        ctx.fillStyle = "#333";
        ctx.fillRect(ex - 18, ey - 28, 36, 5);
        ctx.fillStyle = "lime";
        ctx.fillRect(ex - 18, ey - 28, (room.health / 100) * 36, 5);
    }
}

/* ================= PLAYER DRAW ================= */

function drawPlayer(p) {
    if (p.health <= 0) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = p.strokeColor;
    ctx.stroke();

    // Label
    ctx.fillStyle = "white";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(p.label, p.x, p.y - p.radius - 5);

    // Health bar
    ctx.fillStyle = "#333";
    ctx.fillRect(p.x - 25, p.y - p.radius - 20, 50, 6);
    ctx.fillStyle = p.health > 30 ? "lime" : "red";
    ctx.fillRect(p.x - 25, p.y - p.radius - 20, (p.health / 100) * 50, 6);

    ctx.textAlign = "left";
}

/* ================= FRUITS (MEDKITS) ================= */

const fruits = [];
const FRUIT_DESPAWN = 7;

function isInsideRoom(x, y) {
    for (const room of rooms) {
        if (x > room.x && x < room.x + ROOM_SIZE &&
            y > room.y && y < room.y + ROOM_SIZE) return true;
    }
    return false;
}

function spawnFruit() {
    for (let attempt = 0; attempt < 30; attempt++) {
        const x = MARGIN + Math.random() * (canvas.width - MARGIN * 2);
        const y = MARGIN + Math.random() * (canvas.height - MARGIN * 2);
        if (!isInsideRoom(x, y)) {
            fruits.push({ x, y, emoji: "medkit", radius: 16, timer: FRUIT_DESPAWN });
            break;
        }
    }
}

setInterval(spawnFruit, 15000);

function respawnFruit(i) { fruits.splice(i, 1); spawnFruit(); }

let lastTime = performance.now();

function updateFruits(dt) {
    for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];
        f.timer -= dt;
        if (f.timer <= 0) { respawnFruit(i); continue; }

        let collected = false;
        for (const p of players) {
            if (p.health <= 0) continue;
            if (Math.hypot(p.x - f.x, p.y - f.y) < p.radius + f.radius) {
                p.health = Math.min(100, p.health + 10);
                fruits.splice(i, 1);
                playCollectSound();
                collected = true;
                break;
            }
        }
        if (collected) continue;

        const flashing = f.timer < 2 && Math.floor(f.timer * 5) % 2 === 0;
        if (flashing) continue;

        const mx = f.x - 16, my = f.y - 16, ms = 32;
        ctx.fillStyle = "#cc0000";
        ctx.beginPath();
        ctx.roundRect(mx, my, ms, ms, 4);
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "white";
        ctx.fillRect(mx + 6, my + 13, ms - 12, 6);
        ctx.fillRect(mx + 13, my + 6, 6, ms - 12);
    }
}

/* ================= BULLET BOUNCE ================= */

function bounceBullet(bullet) {
    const walls = getAllWalls();
    for (const seg of walls) {
        if (circleHitsSeg(bullet.x, bullet.y, bullet.radius + 2, seg)) {
            if (bullet.bounces <= 0) return true;
            if (seg.horiz) bullet.dy *= -1;
            else           bullet.dx *= -1;
            bullet.bounces--;
            const res = pushOut(bullet.x, bullet.y, bullet.radius + 2, seg);
            bullet.x = res.x; bullet.y = res.y;
        }
    }
    return false;
}

/* ================= UPDATE PLAYER BULLETS ================= */

function updatePlayerBullets(p) {
    for (let i = p.bullets.length - 1; i >= 0; i--) {
        const bullet = p.bullets[i];
        bullet.x += bullet.dx * bullet.speed;
        bullet.y += bullet.dy * bullet.speed;

        if (bullet.x < 0 || bullet.x > canvas.width ||
            bullet.y < 0 || bullet.y > canvas.height) {
            p.bullets.splice(i, 1); continue;
        }

        if (bounceBullet(bullet)) { p.bullets.splice(i, 1); continue; }

        // Bullets DO NOT hit the other player (as requested)
        let hit = false;
        for (const room of rooms) {
            if (room.dead) continue;
            const enemyX = room.x + room.enemyX;
            const enemyY = room.y + room.enemyY;
            if (Math.hypot(bullet.x - enemyX, bullet.y - enemyY) < 16) {
                room.health -= 20;
                p.bullets.splice(i, 1);
                playHitSound();
                if (room.health <= 0) {
                    room.health = 0;
                    room.dead = true;
                    room.activeP = [false, false];
                    room.killedBy = p.id;
                    p.score++;           // Award score to the player who landed the kill shot
                    playKillSound();
                }
                hit = true; break;
            }
        }
        if (hit) continue;

        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.id === 0 ? "#00ffff" : "#ff88ff";
        ctx.fill();
    }
}

/* ================= UPDATE ENEMY BULLETS ================= */

function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        bullet.x += bullet.dx * bullet.speed;
        bullet.y += bullet.dy * bullet.speed;

        if (bullet.x < 0 || bullet.x > canvas.width ||
            bullet.y < 0 || bullet.y > canvas.height) {
            enemyBullets.splice(i, 1); continue;
        }

        bounceBullet(bullet);

        let hitPlayer = false;
        for (const p of players) {
            if (p.health <= 0) continue;
            if (Math.hypot(bullet.x - p.x, bullet.y - p.y) < p.radius + bullet.radius) {
                p.health -= 10;
                enemyBullets.splice(i, 1);
                playPlayerHitSound();
                hitPlayer = true;
                break;
            }
        }
        if (hitPlayer) continue;

        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fillStyle = "orange";
        ctx.fill();
    }
}

/* ================= UI ================= */

function drawUI() {
    const aliveEnemies = rooms.filter(r => !r.dead).length;
    const p1 = players[0], p2 = players[1];

    // === P1 HUD (top left) ===
    ctx.fillStyle = p1.color;
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "left";
    ctx.fillText("P1 ❤ " + Math.max(0, p1.health), 20, 32);
    ctx.fillStyle = "#aaffaa";
    ctx.font = "13px Arial";
    ctx.fillText("Score: " + p1.score, 20, 52);
    ctx.fillStyle = "#aaaaff";
    ctx.fillText("WASD + Click to shoot", 20, 70);

    // === P2 HUD (top right) ===
    ctx.fillStyle = p2.color;
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "right";
    ctx.fillText("❤ " + Math.max(0, p2.health) + " P2", canvas.width - 20, 32);
    ctx.fillStyle = "#aaffaa";
    ctx.font = "13px Arial";
    ctx.fillText("Score: " + p2.score, canvas.width - 20, 52);
    ctx.fillStyle = "#aaaaff";
    ctx.fillText("Arrows + SPACE to shoot", canvas.width - 20, 70);

    // === Enemies (centre) ===
    ctx.fillStyle = "white";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Enemies: " + aliveEnemies + " / " + (ROWS * COLS), canvas.width / 2, 32);

    ctx.textAlign = "left";

    // === Both players dead ===
    const bothDead = p1.health <= 0 && p2.health <= 0;
    if (bothDead || aliveEnemies === 0) {
        gameOver = true;
        ctx.fillStyle = "rgba(0,0,0,0.70)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let headline, color;
        if (aliveEnemies === 0) {
            headline = "ALL ENEMIES DEFEATED!";
            color = "#00ff88";
        } else if (p1.health <= 0 && p2.health <= 0) {
            headline = "BOTH PLAYERS DEFEATED";
            color = "#ff4444";
        } else if (p1.health <= 0) {
            headline = "P1 DEFEATED"; color = "#ff4444";
        } else {
            headline = "P2 DEFEATED"; color = "#ff4444";
        }

        ctx.fillStyle = color;
        ctx.font = "bold 72px Arial";
        ctx.textAlign = "center";
        ctx.fillText(headline, canvas.width / 2, canvas.height / 2 - 60);

        // Scores
        ctx.fillStyle = p1.color;
        ctx.font = "bold 42px Arial";
        ctx.fillText("P1 Score: " + p1.score, canvas.width / 2, canvas.height / 2 + 10);
        ctx.fillStyle = p2.color;
        ctx.fillText("P2 Score: " + p2.score, canvas.width / 2, canvas.height / 2 + 65);

        // Winner
        ctx.font = "bold 36px Arial";
        if (p1.score > p2.score) {
            ctx.fillStyle = p1.color;
            ctx.fillText("🏆  P1 WINS!", canvas.width / 2, canvas.height / 2 + 125);
        } else if (p2.score > p1.score) {
            ctx.fillStyle = p2.color;
            ctx.fillText("🏆  P2 WINS!", canvas.width / 2, canvas.height / 2 + 125);
        } else {
            ctx.fillStyle = "white";
            ctx.fillText("🤝  IT'S A TIE!", canvas.width / 2, canvas.height / 2 + 125);
        }

        // Restart hint
        ctx.fillStyle = "#aaaaaa";
        ctx.font = "22px Arial";
        ctx.fillText("Press R to play again", canvas.width / 2, canvas.height / 2 + 175);

        ctx.textAlign = "left";
    }

    // Single player dead mid-game
    if (!gameOver) {
        if (p1.health <= 0) {
            ctx.fillStyle = "rgba(255,50,50,0.18)";
            ctx.fillRect(0, 0, canvas.width / 2, canvas.height);
            ctx.fillStyle = "#ff4444";
            ctx.font = "bold 28px Arial";
            ctx.textAlign = "center";
            ctx.fillText("P1 ELIMINATED", canvas.width / 4, canvas.height / 2);
            ctx.textAlign = "left";
        }
        if (p2.health <= 0) {
            ctx.fillStyle = "rgba(50,50,255,0.18)";
            ctx.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height);
            ctx.fillStyle = "#4488ff";
            ctx.font = "bold 28px Arial";
            ctx.textAlign = "center";
            ctx.fillText("P2 ELIMINATED", canvas.width * 3 / 4, canvas.height / 2);
            ctx.textAlign = "left";
        }
    }
}

/* ================= BACKGROUND ================= */

function drawBackground() {
    if (bgImage.complete && bgImage.naturalWidth !== 0) {
        ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = "#1a0030";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

/* ================= RESTART ================= */

window.addEventListener("keydown", e => {
    if (e.key.toLowerCase() === "r" && gameOver) {
        restartGame();
    }
});

function restartGame() {
    gameOver = false;
    for (const p of players) { p.health = 100; p.score = 0; p.bullets.length = 0; }
    enemyBullets.length = 0;
    fruits.length = 0;
    calcLayout();
    createRooms();
    players[0].x = START_X - 30;
    players[0].y = START_Y + (ROWS * ROOM_SIZE + (ROWS - 1) * GAP) / 2;
    players[1].x = START_X + COLS * ROOM_SIZE + (COLS - 1) * GAP + 30;
    players[1].y = START_Y + (ROWS * ROOM_SIZE + (ROWS - 1) * GAP) / 2;
    setTimeout(spawnFruit, 1000);
}

/* ================= GAME LOOP ================= */

let gameOver = false;

function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    if (!gameOver) {
        for (const p of players) {
            if (p.health > 0) movePlayer(p);
        }
        for (const p of players) {
            if (p.health <= 0) { p.health = 0; }
        }
    }

    drawBackground();
    for (const room of rooms) drawRoom(room);
    drawEnemies();
    updateFruits(dt);
    for (const p of players) updatePlayerBullets(p);
    if (!gameOver) updateEnemyBullets();
    for (const p of players) drawPlayer(p);
    drawUI();

    requestAnimationFrame(gameLoop);
}

gameLoop(performance.now());

/* ================= RESIZE ================= */

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    calcLayout();
    createRooms();
    players[0].x = START_X - 30;
    players[0].y = START_Y + (ROWS * ROOM_SIZE + (ROWS - 1) * GAP) / 2;
    players[1].x = START_X + COLS * ROOM_SIZE + (COLS - 1) * GAP + 30;
    players[1].y = START_Y + (ROWS * ROOM_SIZE + (ROWS - 1) * GAP) / 2;
});