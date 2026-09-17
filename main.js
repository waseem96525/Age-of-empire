const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const minimapCanvas = document.getElementById("minimapCanvas");
const minimapCtx = minimapCanvas.getContext("2d");
let mouseDown = false;
let rightMouseDown = false;
let mouseX = 0, mouseY = 0;
let lastMouseX = 0, lastMouseY = 0;
let dragStartX = 0, dragStartY = 0;
let isDragging = false;
let touchStartX = 0, touchStartY = 0;
let touchLastX = 0, touchLastY = 0;
let touchDragging = false;
let gameLoopStarted = false;
const SAVE_KEY = "asian-dynasty-rts-save-v1";

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function showTooltip(text) {
  const tip = document.getElementById("tooltip");
  if (!text) {
    tip.classList.add("hidden");
    return;
  }
  tip.textContent = text;
  tip.style.left = (mouseX + 15) + "px";
  tip.style.top = (mouseY + 15) + "px";
  tip.classList.remove("hidden");
}

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("restart-btn").addEventListener("click", restartGame);
document.getElementById("save-game-btn").addEventListener("click", saveGame);
document.getElementById("load-game-btn").addEventListener("click", loadGame);
document.getElementById("load-game-start-btn").addEventListener("click", loadGame);

// New feature buttons
const upgradeUnitBtn = document.getElementById("upgrade-unit-btn");
const garrisonBtn = document.getElementById("garrison-btn");
const stopBtn = document.getElementById("stop-btn");
if (upgradeUnitBtn) upgradeUnitBtn.addEventListener("click", () => {
  const u = gameState.selectedUnits[0];
  if (u && window.upgradeUnit) window.upgradeUnit(u);
});
if (garrisonBtn) garrisonBtn.addEventListener("click", () => {
  const u = gameState.selectedUnits[0];
  const b = gameState.selectedBuilding;
  if (u && b && window.garrisonUnit) window.garrisonUnit(u, b.id);
  else if (u && window.garrisonUnit) {
    const tc = gameState.buildings.find(b => b.type === "TOWN_CENTER" && b.playerIndex === 0);
    if (tc) window.garrisonUnit(u, tc.id);
  }
});
if (stopBtn) stopBtn.addEventListener("click", () => {
  for (const u of gameState.selectedUnits) unitStop(u);
});

// Formation buttons
const formationButtons = document.querySelectorAll(".formation-btn");
formationButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const formation = btn.dataset.formation;
    const units = gameState.selectedUnits.filter(u => u.alive);
    if (units.length > 0 && gameState.hoverTile) {
      if (window.setFormation) window.setFormation(units, gameState.hoverTile.x, gameState.hoverTile.y, formation);
    }
  });
});

// Speed button handlers
const speedButtons = document.querySelectorAll(".speed-btn");
speedButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const speed = parseFloat(btn.dataset.speed);
    setSpeed(speed);
    speedButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

const muteBtn = document.getElementById("mute-btn");
const musicBtn = document.getElementById("music-btn");
if (muteBtn) muteBtn.addEventListener("click", () => Sound.toggleMute());
if (musicBtn) musicBtn.addEventListener("click", () => Sound.toggleMusic());

// Game speed controls
let gameSpeed = 1;
const SPEED_OPTIONS = [0.5, 1, 2, 3];

function setSpeed(multiplier) {
  gameSpeed = multiplier;
  const speedLabel = document.getElementById("speed-label");
  if (speedLabel) speedLabel.textContent = multiplier + "x";
  addNotification(`Game speed: ${multiplier}x`);
}

document.addEventListener("keydown", (e) => {
  gameState.keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === " ") {
    e.preventDefault();
    gameState.paused = !gameState.paused;
    if (gameState.paused) {
      addNotification("Game paused");
    } else {
      addNotification("Game resumed");
    }
  }
  // Speed controls: Ctrl+1/2/3/4
  if (e.ctrlKey && (e.key === "1" || e.key === "2" || e.key === "3" || e.key === "4")) {
    e.preventDefault();
    const speeds = [0.5, 1, 2, 3];
    const idx = parseInt(e.key) - 1;
    setSpeed(speeds[idx]);
  }
  if (e.key.toLowerCase() === "escape") setBuildMode(null);
  if (e.key >= "1" && e.key <= "7" && !e.ctrlKey) {
    const idx = parseInt(e.key) - 1;
    const types = ["TOWN_CENTER", "HOUSE", "BARRACKS", "FARM", "LUMBER_CAMP", "MINE", "WALL", "STABLE"];
    if (types[idx]) setBuildMode(types[idx]);
  }
  if (e.key.toLowerCase() === "m") {
    Sound.resume();
    if (e.shiftKey) Sound.toggleMusic(); else Sound.toggleMute();
  }
  if (e.key.toLowerCase() === "h") {
    Sound.resume();
    Sound.playClick();
    gameState.selectedUnits.forEach(u => { unitStop(u); advanceCommand(u); });
    addNotification("Units stopped");
  }
  if (e.key.toLowerCase() === "a" && !e.ctrlKey) {
    // Select all military units
    gameState.selectedUnits = gameState.units.filter(u => u.playerIndex === 0 && u.alive && u.type !== "peasant");
    gameState.selectedBuilding = null;
    addNotification(`${gameState.selectedUnits.length} military units selected`);
  }
  if (e.ctrlKey && e.key.toLowerCase() === "a") {
    e.preventDefault();
    Sound.resume();
    gameState.selectedUnits = gameState.units.filter(u => u.playerIndex === 0 && u.alive);
    addNotification(`${gameState.selectedUnits.length} units selected`);
  }
  if (e.key.toLowerCase() === "delete" || e.key === "Backspace") {
    // Deselect all
    gameState.selectedUnits = [];
    gameState.selectedBuilding = null;
  }
});

document.addEventListener("keyup", (e) => {
  gameState.keys[e.key.toLowerCase()] = false;
});

// Enhanced mouse interaction with Ctrl+Click toggle and Shift+Click add
canvas.addEventListener("mousedown", (e) => {
  if (!gameState.started || gameState.gameOver || gameState.paused) return;
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  lastMouseX = mouseX;
  lastMouseY = mouseY;
  if (e.button === 0) {
    mouseDown = true;
    dragStartX = mouseX;
    dragStartY = mouseY;
    // Track modifier keys
    gameState.ctrlHeld = e.ctrlKey;
    gameState.shiftHeld = e.shiftKey;
  } else if (e.button === 2) {
    rightMouseDown = true;
    dragStartX = mouseX;
    dragStartY = mouseY;
  }
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  const wt = getScreenToWorld(mouseX, mouseY);
  gameState.hoverTile = { x: Math.floor(wt.x), y: Math.floor(wt.y) };
  if (rightMouseDown) {
    const dx = mouseX - dragStartX;
    const dy = mouseY - dragStartY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;
    if (isDragging) {
      gameState.camera.x -= (mouseX - lastMouseX) / gameState.camera.zoom;
      gameState.camera.y -= (mouseY - lastMouseY) / gameState.camera.zoom;
    }
    lastMouseX = mouseX;
    lastMouseY = mouseY;
  }
  if (mouseDown) {
    const dx = mouseX - dragStartX;
    const dy = mouseY - dragStartY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 2) {
    if (!isDragging && gameState.started && !gameState.paused) {
      handleRightClick(e);
    }
    rightMouseDown = false;
    isDragging = false;
  } else if (e.button === 0) {
    if (isDragging) {
      const start = getScreenToWorld(dragStartX, dragStartY);
      const end = getScreenToWorld(mouseX, mouseY);
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      // Box selection with modifier support
      const boxUnits = gameState.units.filter(u =>
        u.playerIndex === 0 && u.alive &&
        u.x >= minX && u.x <= maxX &&
        u.y >= minY && u.y <= maxY
      );
      if (e.ctrlKey) {
        // Toggle: add if not selected, remove if already selected
        const currentIds = new Set(gameState.selectedUnits.map(u => u.id));
        boxUnits.forEach(u => {
          if (currentIds.has(u.id)) {
            gameState.selectedUnits = gameState.selectedUnits.filter(s => s.id !== u.id);
          } else {
            gameState.selectedUnits.push(u);
          }
        });
      } else if (e.shiftKey) {
        // Add to selection
        boxUnits.forEach(u => {
          if (!gameState.selectedUnits.some(s => s.id === u.id)) {
            gameState.selectedUnits.push(u);
          }
        });
      } else {
        gameState.selectedUnits = boxUnits;
      }
      gameState.selectedBuilding = null;
    } else {
      handleLeftClick(e);
    }
    mouseDown = false;
    isDragging = false;
    gameState.ctrlHeld = false;
    gameState.shiftHeld = false;
  }
});

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  gameState.camera.zoom = clamp(gameState.camera.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("touchstart", event => {
  if (!gameState.started || gameState.gameOver || gameState.paused || event.touches.length !== 1) return;
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touch = event.touches[0];
  mouseX = touch.clientX - rect.left;
  mouseY = touch.clientY - rect.top;
  touchStartX = touchLastX = mouseX;
  touchStartY = touchLastY = mouseY;
  touchDragging = false;
}, { passive: false });

canvas.addEventListener("touchmove", event => {
  if (!gameState.started || event.touches.length !== 1) return;
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touch = event.touches[0];
  mouseX = touch.clientX - rect.left;
  mouseY = touch.clientY - rect.top;
  const world = getScreenToWorld(mouseX, mouseY);
  gameState.hoverTile = { x: Math.floor(world.x), y: Math.floor(world.y) };
  if (Math.abs(mouseX - touchStartX) > 10 || Math.abs(mouseY - touchStartY) > 10) touchDragging = true;
  if (touchDragging) {
    gameState.camera.x -= (mouseX - touchLastX) / gameState.camera.zoom;
    gameState.camera.y -= (mouseY - touchLastY) / gameState.camera.zoom;
  }
  touchLastX = mouseX;
  touchLastY = mouseY;
}, { passive: false });

canvas.addEventListener("touchend", event => {
  if (!gameState.started || gameState.gameOver || gameState.paused) return;
  event.preventDefault();
  if (!touchDragging) handleTouchTap();
  touchDragging = false;
}, { passive: false });

function handleTouchTap() {
  if (gameState.buildMode) {
    handleLeftClick();
    return;
  }
  const world = getScreenToWorld(mouseX, mouseY);
  const clickedUnit = gameState.units.find(unit =>
    unit.playerIndex === 0 && unit.alive && distance(world.x, world.y, unit.x, unit.y) < 1
  );
  const clickedBuilding = gameState.buildings.find(building =>
    building.playerIndex === 0 && distance(world.x, world.y, building.x, building.y) < 1
  );
  if (clickedUnit || clickedBuilding) {
    handleLeftClick();
  } else if (gameState.selectedUnits.length > 0) {
    handleRightClick();
  }
}

document.getElementById("cancel-build-btn").addEventListener("click", () => setBuildMode(null));
for (const button of document.querySelectorAll("[data-camera]")) {
  button.addEventListener("click", () => {
    const amount = 160;
    const direction = button.dataset.camera;
    if (direction === "up") gameState.camera.y -= amount;
    if (direction === "down") gameState.camera.y += amount;
    if (direction === "left") gameState.camera.x -= amount;
    if (direction === "right") gameState.camera.x += amount;
  });
}
for (const button of document.querySelectorAll("[data-zoom]")) {
  button.addEventListener("click", () => {
    const factor = button.dataset.zoom === "in" ? 1.2 : 0.8;
    gameState.camera.zoom = clamp(gameState.camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  });
}

function handleLeftClick(e) {
  if (gameState.buildMode) {
    if (isBuildable(gameState.hoverTile.x, gameState.hoverTile.y)) {
      const building = createBuilding(gameState.buildMode, gameState.hoverTile.x, gameState.hoverTile.y, 0, gameState.resources);
      if (building) {
        gameState.buildings.push(building);
        addNotification(`Placed ${BUILDINGS[gameState.buildMode].name}`);
      }
    } else {
      addNotification("Cannot build here");
    }
    return;
  }
  const world = getScreenToWorld(mouseX, mouseY);
  const wx = world.x;
  const wy = world.y;
  const clickedUnit = gameState.units.find(u =>
    u.playerIndex === 0 && u.alive &&
    distance(wx, wy, u.x, u.y) < 1
  );
  const clickedBuilding = gameState.buildings.find(b =>
    b.playerIndex === 0 &&
    distance(wx, wy, b.x, b.y) < 1
  );
  if (clickedUnit) {
    if (e && e.ctrlKey) {
      const idx = gameState.selectedUnits.findIndex(u => u.id === clickedUnit.id);
      if (idx >= 0) gameState.selectedUnits.splice(idx, 1);
      else gameState.selectedUnits = [clickedUnit];
    } else {
      gameState.selectedUnits = [clickedUnit];
    }
    gameState.selectedBuilding = null;
  } else if (clickedBuilding) {
    gameState.selectedBuilding = clickedBuilding;
    gameState.selectedUnits = [];
  } else {
    const selected = gameState.selectedUnits.slice();
    gameState.selectedUnits = [];
    gameState.selectedBuilding = null;
    for (const unit of selected) {
      unitMove(unit, wx, wy);
    }
  }
}

function handleRightClick(e) {
  if (gameState.buildMode) {
    setBuildMode(null);
    return;
  }
  const world = getScreenToWorld(mouseX, mouseY);
  const wx = world.x;
  const wy = world.y;
  const shift = e && e.shiftKey;
  if (gameState.selectedBuilding && gameState.selectedBuilding.playerIndex === 0 && BUILDINGS[gameState.selectedBuilding.type].produces.length > 0) {
    gameState.selectedBuilding.rallyX = clamp(wx, 0, MAP_WIDTH - 1);
    gameState.selectedBuilding.rallyY = clamp(wy, 0, MAP_HEIGHT - 1);
    addNotification(`${BUILDINGS[gameState.selectedBuilding.type].name} rally point set`);
    return;
  }
  if (gameState.selectedUnits.length > 0) {
    const enemyUnit = gameState.units.find(u =>
      u.playerIndex !== 0 && u.alive &&
      distance(wx, wy, u.x, u.y) < 3
    );
    const enemyBuilding = gameState.buildings.find(b =>
      b.playerIndex !== 0 && b.hp > 0 &&
      distance(wx, wy, b.x, b.y) < 3
    );
    if (enemyUnit || enemyBuilding) {
      const cmd = { type: "attack" };
      if (enemyUnit) { cmd.targetId = enemyUnit.id; cmd.targetType = "unit"; }
      else { cmd.targetId = enemyBuilding.id; cmd.targetType = "building"; }
      for (const unit of gameState.selectedUnits) {
        if (shift) { unit.commandQueue.push(cmd); advanceCommand(unit); }
        else { unit.commandQueue = []; unitAttack(unit, cmd.targetType, cmd.targetId); }
      }
      return;
    }
    const friendlyBuilding = gameState.buildings.find(b =>
      b.playerIndex === 0 && b.hp < b.maxHp && distance(wx, wy, b.x, b.y) < 2
    );
    if (friendlyBuilding) {
      const cmd = { type: "repair", buildingId: friendlyBuilding.id };
      for (const unit of gameState.selectedUnits) {
        if (shift) { unit.commandQueue.push(cmd); advanceCommand(unit); }
        else { unit.commandQueue = []; unitRepair(unit, cmd.buildingId); }
      }
      return;
    }
    const res = gameState.resourcesOnMap.find(r =>
      !r.depleted && distance(wx, wy, r.x, r.y) <= 3
    );
    if (res) {
      const cmd = { type: "gather", resType: res.type };
      for (const unit of gameState.selectedUnits) {
        if (shift) { unit.commandQueue.push(cmd); advanceCommand(unit); }
        else { unit.commandQueue = []; unitGather(unit, cmd.resType); }
      }
      return;
    }
    const cmd = { type: "attackMove", tx: wx, ty: wy };
    for (const unit of gameState.selectedUnits) {
      if (shift) { unit.commandQueue.push(cmd); advanceCommand(unit); }
      else { unit.commandQueue = []; unitAttackMove(unit, wx, wy); }
    }
    return;
  }
}

function render() {
  try {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderMap(ctx);
    renderFogOfWar(ctx);
    renderBuildings(ctx);
    renderUnits(ctx);
    renderParticles(ctx);
    if (window.renderProjectiles) window.renderProjectiles(ctx);
    if (gameState.buildMode && gameState.hoverTile) {
      const pos = getWorldToScreen(gameState.hoverTile.x, gameState.hoverTile.y);
      const ts = TILE_SIZE * gameState.camera.zoom;
      const canBuildHere = isBuildable(gameState.hoverTile.x, gameState.hoverTile.y);
      ctx.strokeStyle = canBuildHere ? "#4CAF50" : "#f44336";
      ctx.lineWidth = 3;
      ctx.strokeRect(pos.x + ts * 0.1, pos.y + ts * 0.1, ts * 0.8, ts * 0.8);
      ctx.fillStyle = canBuildHere ? "rgba(76,175,80,0.2)" : "rgba(244,67,54,0.2)";
      ctx.fillRect(pos.x + ts * 0.1, pos.y + ts * 0.1, ts * 0.8, ts * 0.8);
    }
    if (gameState.hoverTile && !gameState.buildMode && !gameState.paused) {
      showTooltip(getTileInfo(gameState.hoverTile.x, gameState.hoverTile.y));
    }
  } catch (err) {
    addNotification("Error: " + err.message);
  }
  renderSelectionBox();
}

function renderSelectionBox() {
  if (!mouseDown || isDragging) return;
  const x = Math.min(dragStartX, mouseX);
  const y = Math.min(dragStartY, mouseY);
  const w = Math.abs(mouseX - dragStartX);
  const h = Math.abs(mouseY - dragStartY);
  ctx.strokeStyle = "rgba(240,192,64,0.6)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(240,192,64,0.1)";
  ctx.fillRect(x, y, w, h);
}

function getTileInfo(x, y) {
  const tile = getTile(x, y);
  let info = `Tile: ${tileNames[tile]}`;
  const res = gameState.resourcesOnMap.find(r => r.x === x && r.y === y && !r.depleted);
  if (res) info += `, ${res.type}: ${res.amount}`;
  const building = gameState.buildings.find(b => b.x === x && b.y === y);
  if (building) {
    const def = BUILDINGS[building.type];
    info += `\n${def.name} (HP: ${Math.floor(building.hp)}/${building.maxHp})`;
  }
  const unit = gameState.units.find(u =>
    Math.abs(u.x - x) < 0.5 && Math.abs(u.y - y) < 0.5 && u.alive
  );
  if (unit) {
    const def = UNITS[unit.type.toUpperCase()];
    info += `\n${def.symbol} ${def.name} (HP: ${Math.floor(unit.hp)}/${unit.maxHp})`;
  }
  return info;
}

const tileNames = {
  [TILE.GRASS]: "Grass",
  [TILE.WATER]: "Water",
  [TILE.FOREST]: "Forest",
  [TILE.MOUNTAIN]: "Mountain",
  [TILE.SAND]: "Sand",
  [TILE.PATH]: "Path"
};

function renderParticles(ctx) {
  for (const p of gameState.particles) {
    const pos = getWorldToScreen(p.x, p.y);
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(pos.x - p.size / 2, pos.y - p.size / 2, p.size, p.size);
    ctx.globalAlpha = 1;
  }
}

function getSavedGame() {
  try {
    const rawSave = localStorage.getItem(SAVE_KEY);
    if (!rawSave) return null;
    const save = JSON.parse(rawSave);
    return save && save.version === 1 && Array.isArray(save.mapData) && Array.isArray(save.units) && Array.isArray(save.buildings) ? save : null;
  } catch (error) {
    return null;
  }
}

function updateSaveButtons() {
  const hasSave = Boolean(getSavedGame());
  document.getElementById("load-game-btn").disabled = !hasSave;
  document.getElementById("load-game-start-btn").disabled = !hasSave;
}

function saveGame() {
  if (!gameState.started || gameState.gameOver) return;
  const save = {
    version: 1,
    mapData: window.mapData.map(row => row.slice()),
    resources: { ...gameState.resources },
    population: gameState.population,
    maxPopulation: gameState.maxPopulation,
    camera: { ...gameState.camera },
    gameTime: gameState.gameTime,
    buildings: gameState.buildings,
    units: gameState.units,
    resourcesOnMap: gameState.resourcesOnMap,
    fogOfWar: gameState.fogOfWar,
    aiPlayers: gameState.aiPlayers.map(({ buildings, units, ...ai }) => ({
      ...ai,
      buildingIds: buildings.map(building => building.id),
      unitIds: units.map(unit => unit.id)
    })),
    notifications: gameState.notifications.slice(-10),
    selectedUnitIds: gameState.selectedUnits.map(unit => unit.id),
    selectedBuildingId: gameState.selectedBuilding ? gameState.selectedBuilding.id : null
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    addNotification("Game saved to this browser");
    updateSaveButtons();
  } catch (error) {
    addNotification("Unable to save game in this browser");
  }
}

function loadGame() {
  const save = getSavedGame();
  if (!save) return;
  const buildingById = new Map(save.buildings.map(building => [building.id, building]));
  const unitById = new Map(save.units.map(unit => [unit.id, unit]));
  const aiPlayers = save.aiPlayers.map(({ buildingIds = [], unitIds = [], ...ai }) => ({
    ...ai,
    buildings: buildingIds.map(id => buildingById.get(id)).filter(Boolean),
    units: unitIds.map(id => unitById.get(id)).filter(Boolean)
  }));

  window.mapData.length = 0;
  for (const row of save.mapData) window.mapData.push(row.slice());
  Object.assign(gameState, {
    started: true,
    paused: false,
    gameTime: save.gameTime,
    selectedUnits: save.selectedUnitIds.map(id => unitById.get(id)).filter(Boolean),
    selectedBuilding: save.selectedBuildingId ? buildingById.get(save.selectedBuildingId) || null : null,
    hoverTile: null,
    buildMode: null,
    camera: { ...save.camera },
    keys: {},
    resources: { ...save.resources },
    population: save.population,
    maxPopulation: save.maxPopulation,
    buildings: save.buildings,
    units: save.units,
    resourcesOnMap: save.resourcesOnMap,
    particles: [],
    gameOver: false,
    winner: null,
    aiPlayers,
    fogOfWar: save.fogOfWar,
    notifications: save.notifications || [],
    logTimer: 0,
    lastTime: performance.now()
  });
  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("game-over-screen").classList.add("hidden");
  addNotification("Saved dynasty loaded");
  updateUI();
  ensureGameLoop();
}

function update(dt) {
  if (gameState.paused || gameState.gameOver) return;
  gameState.gameTime += dt;
  updateResources(dt);
  updateBuildings(dt);
  updateUnits(dt);
  updateAI(dt);
  if (window.updateFloatTexts) window.updateFloatTexts(dt);
  if (window.updateProjectiles) window.updateProjectiles(dt);
  gameState.particles = gameState.particles.filter(p => {
    p.life -= p.decay * dt * 60;
    p.x += p.vx;
    p.y += p.vy;
    return p.life > 0;
  });
  checkGameOver();
  updateUI();
  if (gameState.keys.w) gameState.camera.y -= CAMERA_SPEED * dt;
  if (gameState.keys.s) gameState.camera.y += CAMERA_SPEED * dt;
  if (gameState.keys.a) gameState.camera.x -= CAMERA_SPEED * dt;
  if (gameState.keys.d) gameState.camera.x += CAMERA_SPEED * dt;
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - gameState.lastTime) / 1000, 0.1) * gameSpeed;
  gameState.lastTime = timestamp;
  if (!gameState.paused && !gameState.gameOver) {
    update(dt);
  }
  render();
  requestAnimationFrame(gameLoop);
}

function ensureGameLoop() {
  if (gameLoopStarted) return;
  gameLoopStarted = true;
  gameState.lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function startGame() {
  document.getElementById("start-screen").classList.add("hidden");
  Sound.resume();
  Sound.playGameStart();
  Sound.startMusic();
  gameState.started = true;
  initGameState();
  generateMap();
  const centerX = Math.floor(MAP_WIDTH / 2);
  const centerY = Math.floor(MAP_HEIGHT / 2);
  gameState.camera.x = centerX * TILE_SIZE + TILE_SIZE / 2;
  gameState.camera.y = centerY * TILE_SIZE + TILE_SIZE / 2;
  const tc = createBuilding("TOWN_CENTER", centerX, centerY, 0, gameState.resources);
  if (tc) {
    gameState.buildings.push(tc);
  }
  for (let i = 0; i < 5; i++) {
    const unit = createUnit("peasant", centerX + (Math.random() - 0.5), centerY + (Math.random() - 0.5), 0, gameState.resources, gameState, true);
    if (unit) {
      gameState.units.push(unit);
      gameState.population += unit.pop;
    }
  }
  initAI(1);
  initAI(2);
  initAI(3);
  addNotification("Your dynasty has begun");
  addNotification("Build a Town Center and train peasants");
  gameState.lastTime = performance.now();
  ensureGameLoop();
}

function restartGame() {
  document.getElementById("game-over-screen").classList.add("hidden");
  Sound.stopMusic();
  Sound.playGameStart();
  Sound.startMusic();
  gameState.started = false;
  gameState.gameOver = false;
  gameState.winner = null;
  gameState.aiPlayers = [];
  gameState.particles = [];
  gameState.notifications = [];
  initGameState();
  generateMap();
  const centerX = Math.floor(MAP_WIDTH / 2);
  const centerY = Math.floor(MAP_HEIGHT / 2);
  gameState.camera.x = centerX * TILE_SIZE + TILE_SIZE / 2;
  gameState.camera.y = centerY * TILE_SIZE + TILE_SIZE / 2;
  const tc = createBuilding("TOWN_CENTER", centerX, centerY, 0, gameState.resources);
  if (tc) {
    gameState.buildings.push(tc);
  }
  for (let i = 0; i < 5; i++) {
    const unit = createUnit("peasant", centerX + (Math.random() - 0.5), centerY + (Math.random() - 0.5), 0, gameState.resources, gameState, true);
    if (unit) {
      gameState.units.push(unit);
      gameState.population += unit.pop;
    }
  }
  initAI(1);
  initAI(2);
  initAI(3);
  gameState.started = true;
  gameState.lastTime = performance.now();
  ensureGameLoop();
}

function togglePause() {
  gameState.paused = !gameState.paused;
}

document.addEventListener("DOMContentLoaded", () => {
  resizeCanvas();
  generateMap();
  initializeResourceEditor();
  updateSaveButtons();
  updateUI();
  document.addEventListener("pointerdown", () => Sound.resume(), { once: true });
  document.addEventListener("keydown", () => Sound.resume(), { once: true });
  document.addEventListener("click", (e) => {
    if (e.target.closest("button, [role=\"button\"]")) Sound.playClick();
  });
});

window.gameLoop = gameLoop;
window.resizeCanvas = resizeCanvas;
window.showTooltip = showTooltip;
window.saveGame = saveGame;
window.loadGame = loadGame;