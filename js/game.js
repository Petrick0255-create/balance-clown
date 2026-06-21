import { saveScore, getTop5 } from "./firebase.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const selectScreen = document.getElementById("selectScreen");
const selectTitle = document.getElementById("selectTitle");
const cardGrid = document.getElementById("cardGrid");
const panel = document.getElementById("panel");

const timeText = document.getElementById("timeText");
const bestTimeText = document.getElementById("bestTime");
const resetBtn = document.getElementById("resetBtn");

let W, H, CX, CY;

let STAGE_HEIGHT = 220;
let CHARACTER_HEIGHT = 120;
let CHARACTER_OFFSET = 200;

const STAGE_SCALE = {
  bottle: 1.00,
  stick: 0.95,
  chopstick: 0.90,
  soccerball: 0.70,
  pencil: 0.78
};

const CHARACTERS = [
  {
    id: "clown",
    name: "삐에로",
    idle: "images/clown.png",
    left: "images/clown_left.png",
    right: "images/clown_right.png"
  },
  {
    id: "cat",
    name: "고양이",
    idle: "images/cat.png",
    left: "images/cat_left.png",
    right: "images/cat_right.png"
  }
];

const STAGES = [
  {
    id: "bottle",
    name: "페트병",
    img: "images/bottle.png",
    stars: 1,
    difficulty: 0.00175,
    limit: 0.86,
    poleRatio: 0.43
  },
  {
    id: "stick",
    name: "나무막대",
    img: "images/stick.png",
    stars: 2,
    difficulty: 0.0020,
    limit: 0.80,
    poleRatio: 0.46
  },
  {
    id: "chopstick",
    name: "나무젓가락",
    img: "images/chopstick.png",
    stars: 3,
    difficulty: 0.00225,
    limit: 0.74,
    poleRatio: 0.48
  },
  {
    id: "soccerball",
    name: "축구공",
    img: "images/soccerball.png",
    stars: 4,
    difficulty: 0.00255,
    limit: 0.68,
    poleRatio: 0.50
  },
  {
    id: "pencil",
    name: "연필",
    img: "images/pencil.png",
    stars: 5,
    difficulty: 0.0029,
    limit: 0.62,
    poleRatio: 0.52
  }
];

const images = {};

let selectedCharacter = null;
let selectedStage = null;

let screenMode = "character";

let state = "select";

let angle = 0;
let angularVelocity = 0;
let startTime = 0;
let survivalTime = 0;

let windForce = 0;
let hitForce = 0;
let fallingBall = null;
let tapFlash = null;

let rankingLoading = false;
let weeklyTop5 = [];
let lastSavedRank = -1;
let nameInputVisible = false;

function loadImages() {
  const paths = [];

  CHARACTERS.forEach(c => {
    paths.push(c.idle, c.left, c.right);
  });

  STAGES.forEach(s => {
    paths.push(s.img);
  });

  paths.forEach(path => {
    const img = new Image();
    img.src = path;
    images[path] = img;
  });
}

loadImages();

function getBestKey() {
  if (!selectedStage) return "balanceClownBest_default";
  return `balanceClownBest_${selectedStage.id}`;
}

function updateBestText() {
  const best = Number(localStorage.getItem(getBestKey()) || 0);
  bestTimeText.textContent = best.toFixed(2);
}

function vibrate(ms = 18) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function getViewportHeight() {
  return window.visualViewport ? window.visualViewport.height : window.innerHeight;
}

function getHeaderHeight() {
  return window.innerHeight < 700 ? 62 : 72;
}

function setLayoutSize() {
  const vh = getViewportHeight();
  const headerH = getHeaderHeight();

  let panelH = 150;
  if (vh < 700) panelH = 138;
  if (vh < 620) panelH = 126;

  const canvasH = Math.max(320, vh - headerH - panelH);

  document.documentElement.style.setProperty("--app-height", `${vh}px`);
  document.documentElement.style.setProperty("--panel-height", `${panelH}px`);
  document.documentElement.style.setProperty("--canvas-height", `${canvasH}px`);
}

function resize() {
  setLayoutSize();

  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;

  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

  W = rect.width;
  H = rect.height;
  CX = W / 2;
  CY = H * 0.78;
  const GAME_SIZE = Math.min(W, H);

  const GAME_SIZE = Math.min(W, H);

  // 캐릭터 먼저 계산
  CHARACTER_HEIGHT = GAME_SIZE * 0.20;

  // 캐릭터 + 장애물 전체 높이가 화면의 60%를 넘지 않게
  const MAX_TOTAL_HEIGHT = H * 0.60;
  
  // 연필, 젓가락 같은 최고 높이 기준
  STAGE_HEIGHT = MAX_TOTAL_HEIGHT - CHARACTER_HEIGHT;
  
  // 너무 작아지는 것 방지
  STAGE_HEIGHT = Math.max(STAGE_HEIGHT, GAME_SIZE * 0.25);
  
  // 캐릭터 위치
  CHARACTER_OFFSET = STAGE_HEIGHT * 0.95;
}

window.addEventListener("resize", resize);

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resize);
  window.visualViewport.addEventListener("scroll", resize);
}

resize();

function showCharacterSelect() {
  screenMode = "character";
  state = "select";

  selectScreen.classList.remove("hidden");
  canvas.classList.add("hidden");
  panel.classList.add("hidden");

  selectTitle.textContent = "캐릭터 선택";
  cardGrid.innerHTML = "";

  CHARACTERS.forEach(character => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <img src="${character.idle}" alt="${character.name}">
      <div class="card-title">${character.name}</div>
    `;

    card.onclick = () => {
      selectedCharacter = character;
      showStageSelect();
    };

    cardGrid.appendChild(card);
  });
}

function showStageSelect() {
  screenMode = "stage";
  state = "select";

  selectScreen.classList.remove("hidden");
  canvas.classList.add("hidden");
  panel.classList.add("hidden");

  selectTitle.textContent = "장애물 선택";
  cardGrid.innerHTML = "";

  STAGES.forEach(stage => {
    const card = document.createElement("div");
    card.className = "card";

    const stars = "★".repeat(stage.stars) + "☆".repeat(5 - stage.stars);

    card.innerHTML = `
      <img src="${stage.img}" alt="${stage.name}">
      <div class="card-title">${stage.name}</div>
      <div class="stars">${stars}</div>
    `;

    card.onclick = () => {
      selectedStage = stage;
      startGameScreen();
    };

    cardGrid.appendChild(card);
  });
}

function startGameScreen() {
  state = "ready";

  selectScreen.classList.add("hidden");
  canvas.classList.remove("hidden");
  panel.classList.remove("hidden");

  updateBestText();
  resetGame();
}

function resetGame() {
  state = "ready";
  angle = 0;
  angularVelocity = 0;
  survivalTime = 0;
  windForce = 0;
  hitForce = 0;
  fallingBall = null;
  tapFlash = null;
  rankingLoading = false;
  weeklyTop5 = [];
  lastSavedRank = -1;
  nameInputVisible = false;
  timeText.textContent = "0.00";
}

function startPlaying() {
  state = "playing";
  angle = 0;
  angularVelocity = 0;
  survivalTime = 0;
  windForce = 0;
  hitForce = 0;
  fallingBall = null;
  tapFlash = null;
  rankingLoading = false;
  weeklyTop5 = [];
  lastSavedRank = -1;
  nameInputVisible = false;
  startTime = performance.now();
}

async function gameOver() {
  if (state === "gameover") return;

  state = "gameover";
  vibrate(80);

  const bestKey = getBestKey();
  const best = Number(localStorage.getItem(bestKey) || 0);

  if (survivalTime > best) {
    localStorage.setItem(bestKey, survivalTime);
    bestTimeText.textContent = survivalTime.toFixed(2);
  }

  rankingLoading = true;

  try {
    await saveScore({
      score: survivalTime,
      stageId: selectedStage.id,
      characterId: selectedCharacter.id,
      name: ""
    });

    weeklyTop5 = await getTop5(selectedStage.id);

    lastSavedRank = weeklyTop5.findIndex(
      item =>
        Math.abs(Number(item.score) - survivalTime) < 0.001 &&
        item.characterId === selectedCharacter.id
    );

    if (lastSavedRank >= 0) {
      setTimeout(askNameIfRanked, 250);
    }
  } catch (err) {
    console.error("랭킹 저장/조회 실패:", err);
    weeklyTop5 = [];
  }

  rankingLoading = false;
}

function askNameIfRanked() {
  if (nameInputVisible) return;
  if (state !== "gameover") return;
  if (lastSavedRank < 0) return;

  nameInputVisible = true;

  const name = prompt(`${lastSavedRank + 1}위 기록입니다! 이름을 입력하세요.`);

  if (!name) return;

  localStorage.setItem("balanceClownName", name.slice(0, 10));

  saveScore({
    score: survivalTime,
    stageId: selectedStage.id,
    characterId: selectedCharacter.id,
    name: name.slice(0, 10)
  })
    .then(() => getTop5(selectedStage.id))
    .then(top => {
      weeklyTop5 = top;
    })
    .catch(err => console.error("이름 저장 실패:", err));
}

function tapImpulse(side) {
  if (state === "ready") {
    startPlaying();
    vibrate(25);
    return;
  }

  if (state === "gameover") {
    return;
  }

  if (state !== "playing") return;

  const force = 0.035;

  if (side === "left") {
    angularVelocity += force;
  } else {
    angularVelocity -= force;
  }

  tapFlash = {
    side,
    time: performance.now()
  };

  vibrate(18);
}

function handleTap(e) {
  if (state === "select") return;

  if (e.target === resetBtn) return;

  e.preventDefault();

  const x = e.clientX ?? W / 2;
  const side = x < window.innerWidth / 2 ? "left" : "right";

  tapImpulse(side);
}

document.addEventListener("pointerdown", handleTap, { passive: false });

resetBtn.onclick = e => {
  e.stopPropagation();

  if (state === "gameover") {
    resetGame();
  } else {
    resetGame();
  }

  vibrate(20);
};

function updateObstacles() {
  const t = survivalTime;

  windForce = 0;

  if (t > 8) {
    windForce = Math.sin(t * 1.7) * 0.0013;
  }

  if (t > 13 && Math.floor(t) % 7 === 0) {
    hitForce = Math.sin(t * 9) * 0.0028;
  } else {
    hitForce *= 0.93;
  }

  if (t > 18 && !fallingBall && Math.floor(t) % 9 === 0) {
    fallingBall = {
      x: Math.random() < 0.5 ? CX - 90 : CX + 90,
      y: -30,
      vy: 3.6
    };
  }

  if (fallingBall) {
    fallingBall.y += fallingBall.vy;
    fallingBall.vy += 0.09;

    if (fallingBall.y > CY - 160 && fallingBall.y < CY - 90) {
      const side = fallingBall.x < CX ? -1 : 1;
      angularVelocity += side * 0.042;
      fallingBall = null;
      vibrate(35);
    }

    if (fallingBall && fallingBall.y > H + 60) {
      fallingBall = null;
    }
  }
}

function update() {
  if (state !== "playing") return;

  survivalTime = (performance.now() - startTime) / 1000;
  timeText.textContent = survivalTime.toFixed(2);

  updateObstacles();

  const difficulty =
    selectedStage.difficulty + survivalTime * 0.000028;

  const naturalFall = Math.sin(angle) * difficulty;
  const randomShake =
    Math.sin(survivalTime * 2.8) * difficulty * 0.18;
  const obstacleForce = windForce + hitForce;

  angularVelocity += naturalFall;
  angularVelocity += randomShake;
  angularVelocity += obstacleForce;

  angularVelocity *= 0.986;

  angle += angularVelocity;

  if (Math.abs(angle) > selectedStage.limit) {
    gameOver();
  }
}

function drawBackground() {
  ctx.fillStyle = "rgba(255,255,255,0.48)";
  ctx.beginPath();
  ctx.arc(W * 0.18, H * 0.25, 36, 0, Math.PI * 2);
  ctx.arc(W * 0.24, H * 0.23, 28, 0, Math.PI * 2);
  ctx.arc(W * 0.78, H * 0.2, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(34,197,94,0.18)";
  ctx.beginPath();
  ctx.ellipse(CX, H + 24, W * 0.65, 90, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTapFlash() {
  if (!tapFlash) return;

  const elapsed = performance.now() - tapFlash.time;
  const alpha = Math.max(0, 1 - elapsed / 120);

  if (alpha <= 0) {
    tapFlash = null;
    return;
  }

  ctx.save();

  ctx.globalAlpha = alpha * 0.15;
  ctx.fillStyle = tapFlash.side === "left" ? "#38bdf8" : "#fb923c";

  if (tapFlash.side === "left") {
    ctx.fillRect(0, 0, W / 2, H);
  } else {
    ctx.fillRect(W / 2, 0, W / 2, H);
  }

  ctx.restore();
}

function drawStageObject() {
  if (!selectedStage) return;

  const img = images[selectedStage.img];
  if (!img || !img.complete || !img.naturalWidth) return;

  ctx.save();

  // 장애물의 회전축 = 화면 중심 아래 기준점
  ctx.translate(CX, CY);
  ctx.rotate(angle);

  const scale = STAGE_SCALE[selectedStage.id] || 1;

  const targetHeight = STAGE_HEIGHT * scale;

  // 실제 PNG의 아래쪽이 회전축 근처에 오도록 그림
  drawImageBottomAligned(img, 0, bottomY, targetHeight);

  ctx.restore();
}

function getCharacterYOffset() {

  if (!selectedStage) {
    return CHARACTER_OFFSET;
  }

  const scale =
    STAGE_SCALE[selectedStage.id] || 1;

  if (selectedStage.id === "soccerball") {
    return STAGE_HEIGHT * scale * 0.78;
  }

  return STAGE_HEIGHT * scale * 0.95;
}

function drawCharacter() {
  if (!selectedCharacter) return;

  let pose = selectedCharacter.idle;

  if (angle > 0.16) pose = selectedCharacter.right;
  if (angle < -0.16) pose = selectedCharacter.left;

  const img = images[pose];
  if (!img || !img.complete || !img.naturalWidth) return;

  ctx.save();

  ctx.translate(CX, CY);
  ctx.rotate(angle);

  const yOffset = getCharacterYOffset();

  if (!img._bounds) {
    img._bounds = getImageBounds(img);
  }

  const b = img._bounds;

  const maxH = Math.min(130, H * 0.25);
  const scale = maxH / b.height;

  const drawW = b.width * scale;
  const drawH = b.height * scale;

  ctx.drawImage(
    img,
    b.x,
    b.y,
    b.width,
    b.height,
    -drawW / 2,
    -yOffset - drawH + 20,
    drawW,
    drawH
  );

  ctx.restore();
}

function drawObstacles() {
  if (survivalTime > 8 && state === "playing") {
    ctx.fillStyle = "rgba(59,130,246,0.8)";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText("💨", CX + Math.sin(survivalTime * 2) * 145, 50);
  }

  if (survivalTime > 13 && state === "playing") {
    ctx.font = "bold 24px Arial";
    ctx.fillText("💣", 70 + (survivalTime * 80) % (W - 140), 88);
  }

  if (fallingBall) {
    ctx.beginPath();
    ctx.arc(fallingBall.x, fallingBall.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();

    ctx.strokeStyle = "#7f1d1d";
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

function drawStateText() {
  ctx.textAlign = "center";

  if (state === "ready") {
    ctx.fillStyle = "#1f2937";
    ctx.font = `bold ${Math.min(26, W * 0.07)}px Arial`;
    ctx.fillText(`${selectedCharacter.name} + ${selectedStage.name}`, CX, 44);

    ctx.font = `${Math.min(15, W * 0.038)}px Arial`;
    ctx.fillText("터치하여 시작", CX, 72);
    return;
  }

  if (state === "gameover") {
    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 30px Arial";
    ctx.fillText("GAME OVER", CX, 38);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 18px Arial";
    ctx.fillText(`${survivalTime.toFixed(2)}초 버팀`, CX, 66);
    ctx.fillText("다시 버튼으로 재시작", CX, 92);

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 16px Arial";
    ctx.fillText(`🏆 ${selectedStage.name} TOP 5`, CX, 122);

    ctx.font = "14px Arial";

    if (rankingLoading) {
      ctx.fillText("랭킹 불러오는 중...", CX, 146);
    } else if (weeklyTop5.length === 0) {
      ctx.fillText("아직 기록이 없습니다", CX, 146);
    } else {
      weeklyTop5.forEach((item, i) => {
        const name = item.name || "익명";
        ctx.fillText(
          `${i + 1}위 ${name} ${Number(item.score).toFixed(2)}초`,
          CX,
          146 + i * 18
        );
      });
    }
  }
}

function getImageBounds(img) {
  const temp = document.createElement("canvas");
  const tctx = temp.getContext("2d");

  temp.width = img.naturalWidth;
  temp.height = img.naturalHeight;
  tctx.drawImage(img, 0, 0);

  const data = tctx.getImageData(0, 0, temp.width, temp.height).data;

  let minX = temp.width;
  let minY = temp.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < temp.height; y++) {
    for (let x = 0; x < temp.width; x++) {
      const alpha = data[(y * temp.width + x) * 4 + 3];

      if (alpha > 10) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    bottom: maxY
  };
}

function drawImageBottomAligned(img, centerX, bottomY, targetHeight) {
  if (!img || !img.complete || !img.naturalWidth) return;

  if (!img._bounds) {
    img._bounds = getImageBounds(img);
  }

  const b = img._bounds;
  const scale = targetHeight / b.height;

  const drawW = b.width * scale;
  const drawH = b.height * scale;

  ctx.drawImage(
    img,
    b.x,
    b.y,
    b.width,
    b.height,
    centerX - drawW / 2,
    bottomY - drawH,
    drawW,
    drawH
  );
}

function draw() {
  if (state === "select") return;

  ctx.clearRect(0, 0, W, H);

  drawBackground();
  drawTapFlash();
  drawObstacles();
  drawStageObject();
  drawCharacter();
  drawStateText();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

showCharacterSelect();
loop();