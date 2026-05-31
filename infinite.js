const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;

/* ================= MAP SETTINGS ================= */
const ROWS = 4;
const VISIBLE_COLS = 8;
const DOOR_SIZE = 50;
const WALL_T = 5;
const MARGIN = 40;

let ROOM_SIZE, GAP, START_X, START_Y;

function calcLayout() {
    const totalW = canvas.width  - MARGIN * 2;
    const totalH = canvas.height - MARGIN * 2;
    ROOM_SIZE = Math.floor(Math.min(
        totalW / (VISIBLE_COLS + (VISIBLE_COLS - 1) * 0.4),
        totalH / (ROWS + (ROWS - 1) * 0.4)
    ));
    GAP = Math.floor(ROOM_SIZE * 0.4);
    const gridH = ROWS * ROOM_SIZE + (ROWS - 1) * GAP;
    START_X = MARGIN;
    START_Y = Math.floor((canvas.height - gridH) / 2);
}

/* ================= BACKGROUND IMAGE ================= */
const bgImage = new Image();
bgImage.src = "map.png";

/* ================= SOUND ================= */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playShootSound() {
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.start(); osc.stop(audioCtx.currentTime + 0.15);
}
function playHitSound() {
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
}
function playKillSound() {
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}
function playPlayerHitSound() {
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.start(); osc.stop(audioCtx.currentTime + 0.25);
}
function playCollectSound() {
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
}

/* ================= SCORE ================= */
let score = 0;
let colCounter = 0;
let columnsCleared = 0;
let scoreSaved = false;

function saveScore() {
    if (scoreSaved) return;
    scoreSaved = true;
    const prev = parseInt(localStorage.getItem("bestScore")) || 0;
    if (score > prev) localStorage.setItem("bestScore", score);
}

/* ================= PLAYER ================= */
const player = { x: 80, y: 0, radius: 12, speed: 4, health: 100 };

/* ================= INPUT ================= */
const keys = {};
window.addEventListener("keydown", e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener("keyup",   e => { keys[e.key.toLowerCase()] = false; });

/* ================= MOUSE ================= */
let mouseX = 0, mouseY = 0;
canvas.addEventListener("mousemove", e => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
});

/*
 * ================= SCROLL STATE =================
 * worldOffset: how many pixels the world has scrolled left total.
 * scrolling: true only while the cleared left column is animating off-screen.
 * scrollTarget: the worldOffset value we need to reach before stopping.
 */
let worldOffset = 0;
const SCROLL_SPEED = 4;      // pixels per frame during the slide animation
let scrolling = false;
let scrollTarget = 0;

const columns = [];

function makeColumn(colIndex) {
    const worldX = START_X + colIndex * (ROOM_SIZE + GAP);
    const col = { colIndex, worldX, rooms: [] };
    for (let row = 0; row < ROWS; row++) {
        const room = {
            row,
            col: colIndex,
            worldX,
            y: START_Y + row * (ROOM_SIZE + GAP),
            health: 100,
            dead: false,
            active: false,
            enemyX: 30 + Math.random() * (ROOM_SIZE - 60),
            enemyY: 30 + Math.random() * (ROOM_SIZE - 60),
        };
        room.walls = buildWallSegs(room);
        col.rooms.push(room);
    }
    return col;
}

function roomScreenX(room) { return room.worldX - worldOffset; }

/* ================= WALL SEGMENTS ================= */
function buildWallSegs(room) {
    const D = DOOR_SIZE, half = D / 2;
    const segs = [];
    const side = (room.row + room.col) % 4;

    function h(x1, x2, fy) { if (x2 > x1) segs.push({ lx1:x1, lx2:x2, ly:fy, horiz:true }); }
    function v(y1, y2, fx) { if (y2 > y1) segs.push({ ly1:y1, ly2:y2, lx:fx, horiz:false }); }

    const R = ROOM_SIZE;
    if (side === 0) { const c = R/2; h(0, c-half, 0); h(c+half, R, 0); } else { h(0, R, 0); }
    if (side === 1) { const c = R/2; v(0, c-half, R); v(c+half, R, R); } else { v(0, R, R); }
    if (side === 2) { const c = R/2; h(0, c-half, R); h(c+half, R, R); } else { h(0, R, R); }
    if (side === 3) { const c = R/2; v(0, c-half, 0); v(c+half, R, 0); } else { v(0, R, 0); }
    return segs;
}

function resolveSegs(room) {
    const sx = roomScreenX(room);
    const sy = room.y;
    return room.walls.map(seg => {
        if (seg.horiz) {
            return { x1: sx+seg.lx1, y1: sy+seg.ly, x2: sx+seg.lx2, y2: sy+seg.ly, horiz:true };
        } else {
            return { x1: sx+seg.lx, y1: sy+seg.ly1, x2: sx+seg.lx, y2: sy+seg.ly2, horiz:false };
        }
    });
}

/* ================= INIT ================= */
calcLayout();
player.y = START_Y + (ROWS * ROOM_SIZE + (ROWS-1) * GAP) / 2;

for (let i = 0; i < VISIBLE_COLS + 2; i++) {
    columns.push(makeColumn(colCounter++));
}

const playerBullets = [];
const enemyBullets  = [];

/* ================= HELPERS ================= */
function allRooms() {
    const r = [];
    for (const col of columns) r.push(...col.rooms);
    return r;
}

function getAllWalls() {
    const w = [];
    for (const col of columns) {
        for (const room of col.rooms) {
            w.push(...resolveSegs(room));
        }
    }
    return w;
}

/* ================= COLLISION ================= */
function closestPtOnSeg(cx, cy, seg) {
    const dx = seg.x2-seg.x1, dy = seg.y2-seg.y1;
    const len2 = dx*dx + dy*dy;
    if (len2 === 0) return { x: seg.x1, y: seg.y1 };
    const t = Math.max(0, Math.min(1, ((cx-seg.x1)*dx + (cy-seg.y1)*dy)/len2));
    return { x: seg.x1+t*dx, y: seg.y1+t*dy };
}
function circleHitsSeg(cx, cy, r, seg) {
    const p = closestPtOnSeg(cx, cy, seg);
    const dx = cx-p.x, dy = cy-p.y;
    return dx*dx + dy*dy < r*r;
}
function pushOut(cx, cy, r, seg) {
    const p = closestPtOnSeg(cx, cy, seg);
    const dx = cx-p.x, dy = cy-p.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    if (dist < r) { const ov = r-dist; cx += (dx/dist)*ov; cy += (dy/dist)*ov; }
    return { x: cx, y: cy };
}

/* ================= PLAYER MOVEMENT ================= */
function movePlayer() {
    let dx = 0, dy = 0;
    if (keys["w"]) dy -= player.speed;
    if (keys["s"]) dy += player.speed;
    if (keys["a"]) dx -= player.speed;
    if (keys["d"]) dx += player.speed;
    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

    let nx = player.x + dx, ny = player.y + dy;
    const walls = getAllWalls();
    for (let iter = 0; iter < 4; iter++) {
        for (const seg of walls) {
            if (circleHitsSeg(nx, ny, player.radius, seg)) {
                const res = pushOut(nx, ny, player.radius, seg);
                nx = res.x; ny = res.y;
            }
        }
    }
    nx = Math.max(player.radius, Math.min(canvas.width - player.radius, nx));
    ny = Math.max(player.radius, Math.min(canvas.height - player.radius, ny));
    player.x = nx; player.y = ny;

    for (const room of allRooms()) {
        if (room.dead) continue;
        const sx = roomScreenX(room);
        const inside = player.x > sx && player.x < sx + ROOM_SIZE &&
                    player.y > room.y && player.y < room.y + ROOM_SIZE;
        room.active = inside;   // ← mirrors player position every frame
}
}

/* ================= SCROLL ON CLEAR =================
 * Every frame:
 *  1. If already mid-scroll, keep advancing worldOffset toward scrollTarget.
 *     Once reached, drop the left column, add a new one on the right, stop scrolling.
 *  2. If not scrolling, check whether the leftmost column is fully cleared.
 *     If so, set scrollTarget = worldOffset + (ROOM_SIZE + GAP) and start scrolling.
 */
function updateScroll() {
    if (scrolling) {
        worldOffset = Math.min(worldOffset + SCROLL_SPEED, scrollTarget);

        if (worldOffset >= scrollTarget) {
            // Animation done — remove left column, add new one on right
            columns.shift();
            const newCol = makeColumn(colCounter++);
            columns.push(newCol);
            columnsCleared++;
            score += 50;          // bonus for clearing a column
            scrolling = false;
        }
        return;   // don't check for new clears while one is already animating
    }

    // Check if the leftmost column is fully cleared
    if (columns.length === 0) return;
    const leftCol = columns[0];
    const allDead = leftCol.rooms.every(r => r.dead);
    if (allDead) {
        // Trigger scroll: slide exactly one column-width to the left
        scrollTarget = worldOffset + ROOM_SIZE + GAP;
        scrolling = true;
    }
}

/* ================= SHOOT ================= */
canvas.addEventListener("click", () => {
    if (gameOver) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    const angle = Math.atan2(mouseY-player.y, mouseX-player.x);
    playerBullets.push({ x:player.x, y:player.y, dx:Math.cos(angle), dy:Math.sin(angle), speed:8, radius:4, bounces:4 });
    playShootSound();
});

/* ================= DRAW ROOM ================= */
function drawRoom(room) {
    const sx = roomScreenX(room);
    const sy = room.y;
    if (sx + ROOM_SIZE < 0 || sx > canvas.width) return;

    if (room.dead) {
        ctx.fillStyle = "#1a2a1a";
        ctx.fillRect(sx, sy, ROOM_SIZE, ROOM_SIZE);
    } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(sx, sy, ROOM_SIZE, ROOM_SIZE);
        ctx.clip();
        if (bgImage.complete && bgImage.naturalWidth !== 0) {
            ctx.drawImage(bgImage, sx, sy, ROOM_SIZE, ROOM_SIZE);
        } else {
            ctx.fillStyle = "#2a1a3a";
            ctx.fillRect(sx, sy, ROOM_SIZE, ROOM_SIZE);
        }
        ctx.restore();
    }

    ctx.lineWidth = WALL_T; ctx.strokeStyle = "#111"; ctx.lineCap = "square";
    for (const seg of resolveSegs(room)) {
        ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke();
    }

    ctx.fillStyle = "#ffb300";
    const D = DOOR_SIZE, side = (room.row + room.col) % 4;
    if (side===0) ctx.fillRect(sx+ROOM_SIZE/2-D/2, sy-4, D, 8);
    if (side===1) ctx.fillRect(sx+ROOM_SIZE-4, sy+ROOM_SIZE/2-D/2, 8, D);
    if (side===2) ctx.fillRect(sx+ROOM_SIZE/2-D/2, sy+ROOM_SIZE-4, D, 8);
    if (side===3) ctx.fillRect(sx-4, sy+ROOM_SIZE/2-D/2, 8, D);
}

/* ================= DRAW ENEMIES ================= */
function drawEnemies() {
    for (const room of allRooms()) {
        if (room.dead) continue;
        const sx = roomScreenX(room);
        if (sx + ROOM_SIZE < 0 || sx > canvas.width) continue;
        const ex = sx + room.enemyX;
        const ey = room.y + room.enemyY;
        ctx.beginPath(); ctx.arc(ex, ey, 12, 0, Math.PI*2);
        ctx.fillStyle = "red"; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = "black"; ctx.stroke();
        ctx.fillStyle = "#333"; ctx.fillRect(ex-18, ey-28, 36, 5);
        ctx.fillStyle = "lime"; ctx.fillRect(ex-18, ey-28, (room.health/100)*36, 5);
    }
}

/* ================= ENEMY SHOOT ================= */
function enemyShootAll() {
    for (const room of allRooms()) {
        if (!room.active || room.dead) continue;
        const sx = roomScreenX(room);
        const ex = sx + room.enemyX;
        const ey = room.y + room.enemyY;
        const angle = Math.atan2(player.y-ey, player.x-ex);
        enemyBullets.push({ x:ex, y:ey, dx:Math.cos(angle), dy:Math.sin(angle), speed:5, radius:4, bounces:3 });
    }
}
setInterval(enemyShootAll, 1500);

/* ================= DRAW PLAYER ================= */
function drawPlayer() {
    ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2);
    ctx.fillStyle = "yellow"; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = "black"; ctx.stroke();
    ctx.fillStyle = "#333"; ctx.fillRect(player.x-25, player.y-30, 50, 6);
    ctx.fillStyle = player.health > 30 ? "lime" : "red";
    ctx.fillRect(player.x-25, player.y-30, (player.health/100)*50, 6);
}

/* ================= BULLET BOUNCE ================= */
function bounceBullet(bullet) {
    const walls = getAllWalls();
    for (const seg of walls) {
        if (circleHitsSeg(bullet.x, bullet.y, bullet.radius+2, seg)) {
            if (bullet.bounces <= 0) return true;
            if (seg.horiz) bullet.dy *= -1; else bullet.dx *= -1;
            bullet.bounces--;
            const res = pushOut(bullet.x, bullet.y, bullet.radius+2, seg);
            bullet.x = res.x; bullet.y = res.y;
        }
    }
    return false;
}

/* ================= UPDATE PLAYER BULLETS ================= */
function updatePlayerBullets() {
    for (let i = playerBullets.length-1; i >= 0; i--) {
        const b = playerBullets[i];
        b.x += b.dx*b.speed; b.y += b.dy*b.speed;
        if (b.x<0||b.x>canvas.width||b.y<0||b.y>canvas.height) { playerBullets.splice(i,1); continue; }
        if (bounceBullet(b)) { playerBullets.splice(i,1); continue; }

        let hit = false;
        for (const room of allRooms()) {
            if (room.dead) continue;
            const ex = roomScreenX(room) + room.enemyX;
            const ey = room.y + room.enemyY;
            if (Math.hypot(b.x-ex, b.y-ey) < 16) {
                room.health -= 20;
                playerBullets.splice(i,1);
                playHitSound();
                if (room.health <= 0) {
                    room.health=0; room.dead=true; room.active=false;
                    score += 100;
                    playKillSound();
                }
                hit = true; break;
            }
        }
        if (hit) continue;

        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2);
        ctx.fillStyle = "#00ffff"; ctx.fill();
    }
}

/* ================= UPDATE ENEMY BULLETS ================= */
function updateEnemyBullets() {
    for (let i = enemyBullets.length-1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.x += b.dx*b.speed; b.y += b.dy*b.speed;
        if (b.x<0||b.x>canvas.width||b.y<0||b.y>canvas.height) { enemyBullets.splice(i,1); continue; }
        bounceBullet(b);
        if (Math.hypot(b.x-player.x, b.y-player.y) < player.radius+b.radius) {
            player.health -= 10; enemyBullets.splice(i,1); playPlayerHitSound(); continue;
        }
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2);
        ctx.fillStyle = "orange"; ctx.fill();
    }
}

/* ================= MEDKITS ================= */
const medkits = [];
const MEDKIT_DESPAWN = 7;

function isInsideAnyRoom(x, y) {
    for (const room of allRooms()) {
        const sx = roomScreenX(room);
        if (x > sx && x < sx+ROOM_SIZE && y > room.y && y < room.y+ROOM_SIZE) return true;
    }
    return false;
}

function spawnMedkit() {
    for (let attempt = 0; attempt < 30; attempt++) {
        const x = MARGIN + Math.random()*(canvas.width - MARGIN*2);
        const y = MARGIN + Math.random()*(canvas.height - MARGIN*2);
        if (!isInsideAnyRoom(x, y)) {
            medkits.push({ x, y, radius:16, timer:MEDKIT_DESPAWN });
            break;
        }
    }
}
setInterval(spawnMedkit, 15000);

let lastTime = performance.now();

function updateMedkits(dt) {
    for (let i = medkits.length-1; i >= 0; i--) {
        const m = medkits[i];
        m.timer -= dt;
        // Medkits scroll with the world only during a scroll animation
        if (scrolling) m.x -= SCROLL_SPEED;

        if (m.timer <= 0 || m.x < -20) {
            medkits.splice(i,1);
            spawnMedkit();
            continue;
        }
        if (Math.hypot(player.x-m.x, player.y-m.y) < player.radius+m.radius) {
            player.health = Math.min(100, player.health+10);
            medkits.splice(i,1);
            playCollectSound();
            continue;
        }
        const flashing = m.timer < 2 && Math.floor(m.timer*5)%2===0;
        if (flashing) continue;

        const mx = m.x-16, my = m.y-16, ms = 32;
        ctx.fillStyle = "#cc0000";
        ctx.beginPath(); ctx.roundRect(mx, my, ms, ms, 5); ctx.fill();
        ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "white";
        ctx.fillRect(mx+6, my+13, ms-12, 6);
        ctx.fillRect(mx+13, my+6, 6, ms-12);
    }
}

/* ================= UI ================= */
function drawUI() {
    ctx.fillStyle = "white"; ctx.font = "bold 22px Arial";
    ctx.fillText("Health: "+Math.max(0, player.health), 20, 35);
    ctx.fillStyle = "#aaffaa"; ctx.font = "15px Arial";
    ctx.fillText("Survive as long as possible! Medkits = +10 HP", 20, 58);

    ctx.fillStyle = "#FFD700"; ctx.font = "bold 22px Arial";
    ctx.textAlign = "right";
    ctx.fillText("SCORE: "+score, canvas.width-20, 35);
    ctx.textAlign = "left";

    ctx.fillStyle = "white"; ctx.font = "18px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Columns cleared: " + columnsCleared, canvas.width/2, 35);
    ctx.textAlign = "left";

    // Show "CLEAR!" prompt if leftmost column still has enemies alive
    if (!scrolling && columns.length > 0) {
        const leftAlive = columns[0].rooms.some(r => !r.dead);
        if (leftAlive) {
            ctx.fillStyle = "rgba(255,200,0,0.85)";
            ctx.font = "bold 16px Arial";
            ctx.textAlign = "center";
            ctx.fillText("▶ Clear the left column to advance!", canvas.width/2, canvas.height - 20);
            ctx.textAlign = "left";
        }
    }

    if (player.health <= 0) {
        saveScore();
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = "red"; ctx.font = "bold 80px Arial"; ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2-40);
        ctx.fillStyle = "#FFD700"; ctx.font = "bold 40px Arial";
        ctx.fillText("FINAL SCORE: "+score, canvas.width/2, canvas.height/2+30);
        ctx.fillStyle = "white"; ctx.font = "24px Arial";
        ctx.fillText("Columns cleared: "+columnsCleared, canvas.width/2, canvas.height/2+90);
        ctx.textAlign = "left";
    }
}

/* ================= BACKGROUND ================= */
function drawBackground() {
    if (bgImage.complete && bgImage.naturalWidth !== 0) {
        ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = "#1a0030"; ctx.fillRect(0,0,canvas.width,canvas.height);
    }
}

/* ================= GAME LOOP ================= */
let gameOver = false;

function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    if (!gameOver) {
        updateScroll();
        movePlayer();
        if (player.health <= 0) gameOver = true;
    }

    drawBackground();
    for (const col of columns) for (const room of col.rooms) drawRoom(room);
    drawEnemies();
    updateMedkits(dt);
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
    player.y = START_Y + (ROWS * ROOM_SIZE + (ROWS-1) * GAP) / 2;
});