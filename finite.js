const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

/* ================= SCREEN ================= */

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
    const totalW = canvas.width  - MARGIN * 2;
    const totalH = canvas.height - MARGIN * 2;
    ROOM_SIZE = Math.floor(Math.min(
        totalW / (COLS + (COLS - 1) * 0.4),
        totalH / (ROWS + (ROWS - 1) * 0.4)
    ));
    GAP = Math.floor(ROOM_SIZE * 0.4);
    const gridW = COLS * ROOM_SIZE + (COLS - 1) * GAP;
    const gridH = ROWS * ROOM_SIZE + (ROWS - 1) * GAP;
    START_X = Math.floor((canvas.width  - gridW) / 2);
    START_Y = Math.floor((canvas.height - gridH) / 2);
}

/* ================= BACKGROUND IMAGE ================= */

const bgImage = new Image();
bgImage.src = "map.png";

/* ================= SOUND ================= */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playShootSound() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

function playHitSound() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
}

function playKillSound() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

function playPlayerHitSound() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
}

function playCollectSound() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
}

/* ================= PLAYER ================= */

const player = {
    x: 20,
    y: 20,
    radius: 12,
    speed: 4,
    health: 100
};

/* ================= INPUT ================= */

const keys = {};

window.addEventListener("keydown", e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener("keyup",   e => { keys[e.key.toLowerCase()] = false; });

/* ================= MOUSE ================= */

let mouseX = 0;
let mouseY = 0;

canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

/* ================= ROOMS ================= */

const rooms = [];
let columnsCleared = 0;

function buildWallSegs(room) {
    const { x, y } = room;
    const R = ROOM_SIZE;
    const D = DOOR_SIZE;
    const half = D / 2;
    const segs = [];

    function h(x1, x2, fy) { if (x2 > x1) segs.push({ x1, y1: fy, x2, y2: fy, horiz: true }); }
    function v(y1, y2, fx) { if (y2 > y1) segs.push({ x1: fx, y1, x2: fx, y2, horiz: false }); }

    const side = (room.row + room.col) % 4;

    if (side === 0) {
        const c = x + ROOM_SIZE / 2;
        h(x, c - half, y);
        h(c + half, x + R, y);
    } else { h(x, x + R, y); }

    if (side === 1) {
        const c = y + ROOM_SIZE / 2;
        v(y, c - half, x + R);
        v(c + half, y + R, x + R);
    } else { v(y, y + R, x + R); }

    if (side === 2) {
        const c = x + ROOM_SIZE / 2;
        h(x, c - half, y + R);
        h(c + half, x + R, y + R);
    } else { h(x, x + R, y + R); }

    if (side === 3) {
        const c = y + ROOM_SIZE / 2;
        v(y, c - half, x);
        v(c + half, y + R, x);
    } else { v(y, y + R, x); }

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
                active: false,
                enemyX: 30 + Math.random() * (ROOM_SIZE - 60),
                enemyY: 30 + Math.random() * (ROOM_SIZE - 60)
            };
            room.walls = buildWallSegs(room);
            rooms.push(room);
        }
    }
}

calcLayout();
createRooms();

player.x = START_X - 20;
player.y = START_Y + (ROWS * ROOM_SIZE + (ROWS - 1) * GAP) / 2;

setTimeout(spawnFruit, 1000);

const playerBullets = [];
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
    if (dist < r) {
        const overlap = r - dist;
        cx += (dx / dist) * overlap;
        cy += (dy / dist) * overlap;
    }
    return { x: cx, y: cy };
}

function getAllWalls() {
    const w = [];
    for (const room of rooms) w.push(...room.walls);
    return w;
}

/* ================= PLAYER MOVEMENT ================= */

function movePlayer() {
    let dx = 0, dy = 0;
    if (keys["w"]) dy -= player.speed;
    if (keys["s"]) dy += player.speed;
    if (keys["a"]) dx -= player.speed;
    if (keys["d"]) dx += player.speed;
    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

    let nx = player.x + dx;
    let ny = player.y + dy;

    const walls = getAllWalls();
    for (let iter = 0; iter < 4; iter++) {
        for (const seg of walls) {
            if (circleHitsSeg(nx, ny, player.radius, seg)) {
                const res = pushOut(nx, ny, player.radius, seg);
                nx = res.x; ny = res.y;
            }
        }
    }

    nx = Math.max(player.radius, Math.min(canvas.width  - player.radius, nx));
    ny = Math.max(player.radius, Math.min(canvas.height - player.radius, ny));
    player.x = nx;
    player.y = ny;

    // FIX: active mirrors player position — true only while inside, false when they leave
    for (const room of rooms) {
        if (room.dead) continue;
        const inside = player.x > room.x && player.x < room.x + ROOM_SIZE &&
                       player.y > room.y && player.y < room.y + ROOM_SIZE;
        room.active = inside;
    }
}

/* ================= COLUMN CLEAR ================= */

function checkColumnClear() {
    for (let col = 0; col < COLS; col++) {
        const colRooms = rooms.filter(r => r.col === col);
        if (colRooms.every(r => r.dead)) {
            columnsCleared++;
        }
    }
}

/* ================= SHOOT ================= */

canvas.addEventListener("click", () => {
    if (gameOver) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
    playerBullets.push({
        x: player.x, y: player.y,
        dx: Math.cos(angle), dy: Math.sin(angle),
        speed: 8, radius: 4, bounces: 4
    });
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
        // FIX: guard so bg image only draws once loaded
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

/* ================= DOORS ================= */

function drawDoors(room) {
    ctx.fillStyle = "#ffb300";
    const doorSize = DOOR_SIZE;
    const side = (room.row + room.col) % 4;

    if (side === 0) ctx.fillRect(room.x + ROOM_SIZE / 2 - doorSize / 2, room.y - 4, doorSize, 8);
    if (side === 1) ctx.fillRect(room.x + ROOM_SIZE - 4, room.y + ROOM_SIZE / 2 - doorSize / 2, 8, doorSize);
    if (side === 2) ctx.fillRect(room.x + ROOM_SIZE / 2 - doorSize / 2, room.y + ROOM_SIZE - 4, doorSize, 8);
    if (side === 3) ctx.fillRect(room.x - 4, room.y + ROOM_SIZE / 2 - doorSize / 2, 8, doorSize);
}

/* ================= ENEMY SHOOT ================= */

setInterval(() => {
    for (const room of rooms) {
        if (!room.active || room.dead) continue;
        const enemyX = room.x + room.enemyX;
        const enemyY = room.y + room.enemyY;
        const angle = Math.atan2(player.y - enemyY, player.x - enemyX);
        enemyBullets.push({
            x: enemyX, y: enemyY,
            dx: Math.cos(angle), dy: Math.sin(angle),
            speed: 5, radius: 4, bounces: 3
        });
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

function drawPlayer() {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = "yellow";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "black";
    ctx.stroke();

    ctx.fillStyle = "#333";
    ctx.fillRect(player.x - 25, player.y - 30, 50, 6);
    ctx.fillStyle = player.health > 30 ? "lime" : "red";
    ctx.fillRect(player.x - 25, player.y - 30, (player.health / 100) * 50, 6);
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
        const x = MARGIN + Math.random() * (canvas.width  - MARGIN * 2);
        const y = MARGIN + Math.random() * (canvas.height - MARGIN * 2);
        if (!isInsideRoom(x, y)) {
            fruits.push({ x, y, emoji: "medkit", radius: 16, timer: FRUIT_DESPAWN });
            break;
        }
    }
}

setInterval(spawnFruit, 15000);

function respawnFruit(i) {
    fruits.splice(i, 1);
    spawnFruit();
}

let lastTime = performance.now();

function updateFruits(dt) {
    for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];
        f.timer -= dt;

        if (f.timer <= 0) { respawnFruit(i); continue; }

        if (Math.hypot(player.x - f.x, player.y - f.y) < player.radius + f.radius) {
            player.health = Math.min(100, player.health + 10);
            fruits.splice(i, 1);
            playCollectSound();
            continue;
        }

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

function updatePlayerBullets() {
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const bullet = playerBullets[i];
        bullet.x += bullet.dx * bullet.speed;
        bullet.y += bullet.dy * bullet.speed;

        if (bullet.x < 0 || bullet.x > canvas.width ||
            bullet.y < 0 || bullet.y > canvas.height) {
            playerBullets.splice(i, 1); continue;
        }

        if (bounceBullet(bullet)) { playerBullets.splice(i, 1); continue; }

        let hit = false;
        for (const room of rooms) {
            if (room.dead) continue;
            const enemyX = room.x + room.enemyX;
            const enemyY = room.y + room.enemyY;
            if (Math.hypot(bullet.x - enemyX, bullet.y - enemyY) < 16) {
                room.health -= 20;
                playerBullets.splice(i, 1);
                playHitSound();
                if (room.health <= 0) {
                    room.health = 0;
                    room.dead = true;
                    room.active = false;
                    checkColumnClear();
                    playKillSound();
                }
                hit = true; break;
            }
        }
        if (hit) continue;

        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#00ffff";
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

        if (Math.hypot(bullet.x - player.x, bullet.y - player.y) < player.radius + bullet.radius) {
            player.health -= 10;
            enemyBullets.splice(i, 1);
            playPlayerHitSound();
            continue;
        }

        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fillStyle = "orange";
        ctx.fill();
    }
}

/* ================= UI ================= */

function drawUI() {
    const aliveEnemies = rooms.filter(r => !r.dead).length;

    // Health (top left)
    ctx.fillStyle = "white";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Health: " + Math.max(0, player.health), 20, 35);
    ctx.fillStyle = "#aaffaa";
    ctx.font = "15px Arial";
    ctx.fillText("Collect medkits for +10 HP  (spawn every 15s)", 20, 58);

    // Enemies remaining (top centre)
    ctx.fillStyle = "white";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Enemies: " + aliveEnemies + " / " + (ROWS * COLS), canvas.width / 2, 35);

    // Columns cleared (top right)
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "right";
    ctx.fillText("Columns cleared: " + columnsCleared, canvas.width - 20, 35);

    ctx.textAlign = "left";

    // Game over overlay
    if (player.health <= 0) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "red";
        ctx.font = "bold 80px Arial";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40);
        ctx.fillStyle = "white";
        ctx.font = "bold 36px Arial";
        ctx.fillText("Enemies defeated: " + (ROWS * COLS - aliveEnemies) + " / " + (ROWS * COLS), canvas.width / 2, canvas.height / 2 + 30);
        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 30px Arial";
        ctx.fillText("Columns cleared: " + columnsCleared, canvas.width / 2, canvas.height / 2 + 80);
        ctx.textAlign = "left";
    }

    // Win screen
    if (aliveEnemies === 0) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#00ff88";
        ctx.font = "bold 80px Arial";
        ctx.textAlign = "center";
        ctx.fillText("YOU WIN!", canvas.width / 2, canvas.height / 2 - 40);
        ctx.fillStyle = "white";
        ctx.font = "bold 32px Arial";
        ctx.fillText("All " + (ROWS * COLS) + " enemies defeated!", canvas.width / 2, canvas.height / 2 + 30);
        ctx.textAlign = "left";
        gameOver = true;
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

/* ================= GAME LOOP ================= */

let gameOver = false;

function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    if (!gameOver) {
        movePlayer();
        if (player.health <= 0) gameOver = true;
    }

    drawBackground();
    for (const room of rooms) drawRoom(room);
    drawEnemies();
    updateFruits(dt);
    updatePlayerBullets();
    if (!gameOver) updateEnemyBullets();
    drawPlayer();
    drawUI();

    requestAnimationFrame(gameLoop);
}

gameLoop(performance.now());

/* ================= RESIZE ================= */

window.addEventListener("resize", () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    calcLayout();
    createRooms();
    player.x = START_X - 20;
    player.y = START_Y + (ROWS * ROOM_SIZE + (ROWS - 1) * GAP) / 2;
});