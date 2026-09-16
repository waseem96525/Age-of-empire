function updateUI() {
  const r = gameState.resources;
  document.getElementById("food-val").textContent = Math.floor(r.food);
  document.getElementById("wood-val").textContent = Math.floor(r.wood);
  document.getElementById("gold-val").textContent = Math.floor(r.gold);
  document.getElementById("stone-val").textContent = Math.floor(r.stone);
  document.getElementById("pop-val").textContent = `${gameState.population}/${gameState.maxPopulation}`;
  updateResourceEditor(r);
  const selectedInfo = document.getElementById("selected-info");
  if (gameState.buildMode) {
    const def = BUILDINGS[gameState.buildMode];
    selectedInfo.innerHTML = `<h4>Build: ${def.name}</h4><p>Cost: ${formatCost(def.cost)}</p><p>Right-click to cancel</p>`;
  } else if (gameState.selectedUnits.length === 1) {
    const u = gameState.selectedUnits[0];
    const def = UNITS[u.type.toUpperCase()];
    selectedInfo.innerHTML = `<h4>${u.symbol} ${def.name}</h4><p>HP: ${Math.floor(u.hp)}/${u.maxHp}</p><p>ATK: ${u.attack} | ARM: ${u.armor}</p><p>Task: ${u.task}</p>`;
  } else if (gameState.selectedUnits.length > 1) {
    selectedInfo.innerHTML = `<h4>${gameState.selectedUnits.length} Units Selected</h4>`;
  } else if (gameState.selectedBuilding) {
    const b = gameState.selectedBuilding;
    const def = BUILDINGS[b.type];
    selectedInfo.innerHTML = `<h4>${def.name}</h4><p>HP: ${Math.floor(b.hp)}/${b.maxHp}</p><p>Queue: ${b.produceQueue.length > 0 ? UNITS[b.produceQueue[0].toUpperCase()].name : "Empty"}</p>`;
  } else {
    selectedInfo.innerHTML = `<h4>No Selection</h4><p>Click units or buildings to select</p>`;
  }
  updateBuildButtons();
  updateMinimap();
  gameState.logTimer += 1 / 60;
  if (gameState.logTimer >= 1) {
    gameState.logTimer = 0;
  }
  const log = document.getElementById("game-log");
  const recent = gameState.notifications.slice(-5);
  log.innerHTML = recent.map(n => `<div class="log-entry">${n.text}</div>`).join("");
  log.scrollTop = log.scrollHeight;
}

function formatCost(cost) {
  return Object.entries(cost).map(([k, v]) => `${k}:${v}`).join(" ");
}

function updateResourceEditor(resources) {
  for (const type of ["food", "wood", "gold", "stone"]) {
    const input = document.getElementById(`resource-${type}`);
    if (document.activeElement !== input && input.dataset.dirty !== "true") {
      input.value = Math.floor(resources[type]);
    }
  }
}

function initializeResourceEditor() {
  const applyButton = document.getElementById("apply-resources-btn");
  const resourceTypes = ["food", "wood", "gold", "stone"];
  for (const type of resourceTypes) {
    document.getElementById(`resource-${type}`).addEventListener("input", event => {
      event.currentTarget.dataset.dirty = "true";
    });
  }
  applyButton.addEventListener("click", () => {
    for (const type of resourceTypes) {
      const input = document.getElementById(`resource-${type}`);
      const value = Number(input.value);
      if (!Number.isFinite(value)) continue;
      gameState.resources[type] = clamp(Math.floor(value), 0, 9999);
      input.dataset.dirty = "false";
    }
    addNotification("Resources updated");
    updateUI();
  });
}

function updateBuildButtons() {
  const buildingBtns = document.getElementById("building-buttons");
  const unitBtns = document.getElementById("unit-buttons");
  const types = ["TOWN_CENTER", "BARRACKS", "FARM", "LUMBER_CAMP", "MINE", "WALL", "STABLE"];
  const unitTypes = ["peasant", "samurai", "archer", "cavalry", "warrior"];

  if (!buildingBtns.dataset.initialized) {
    for (const type of types) {
      const def = BUILDINGS[type];
      const btn = document.createElement("button");
      btn.className = "build-btn";
      btn.dataset.building = type;
      btn.innerHTML = `${def.name} <span class="cost">${formatCost(def.cost)}</span>`;
      btn.onclick = () => setBuildMode(type);
      buildingBtns.appendChild(btn);
    }
    buildingBtns.dataset.initialized = "true";
  }

  if (!unitBtns.dataset.initialized) {
    for (const type of unitTypes) {
      const def = UNITS[type.toUpperCase()];
      const btn = document.createElement("button");
      btn.className = "build-btn";
      btn.dataset.unit = type;
      btn.innerHTML = `${def.symbol} ${def.name} <span class="cost">${formatCost(def.cost)}</span>`;
      btn.onclick = () => trainUnit(type);
      unitBtns.appendChild(btn);
    }
    unitBtns.dataset.initialized = "true";
  }

  for (const type of types) {
    const btn = buildingBtns.querySelector(`[data-building="${type}"]`);
    btn.disabled = !canAfford(gameState.resources, BUILDINGS[type].cost);
  }
  for (const type of unitTypes) {
    const def = UNITS[type.toUpperCase()];
    const btn = unitBtns.querySelector(`[data-unit="${type}"]`);
    const canProduce = gameState.buildings.some(building =>
      building.playerIndex === 0 && BUILDINGS[building.type].produces.includes(type)
    );
    btn.disabled = !canProduce || !canAfford(gameState.resources, def.cost) || gameState.population + def.pop > gameState.maxPopulation;
    btn.title = canProduce ? "" : `Requires ${type === "cavalry" ? "a Stable" : type === "peasant" ? "a Town Center" : "a Barracks"}`;
  }
}

function setBuildMode(type) {
  gameState.buildMode = type ? BUILDINGS[type] ? type : null : null;
  gameState.selectedUnits = [];
  gameState.selectedBuilding = null;
  if (type) addNotification(`Place ${BUILDINGS[type].name} - left click to build, right click to cancel`);
}

function trainUnit(type) {
  const def = UNITS[type.toUpperCase()];
  if (!def) return;
  const selectedBuilding = gameState.selectedBuilding;
  const canProduce = building => building.playerIndex === 0 && BUILDINGS[building.type].produces.includes(type);
  const productionBuilding = selectedBuilding && canProduce(selectedBuilding)
    ? selectedBuilding
    : gameState.buildings.find(canProduce);
  if (!productionBuilding) { addNotification("Required production building not found"); return; }
  if (!canAfford(gameState.resources, def.cost)) { addNotification("Not enough resources!"); return; }
  if (gameState.population + def.pop > gameState.maxPopulation) { addNotification("Population limit reached"); return; }
  if (productionBuilding.produceQueue.length >= 3) { addNotification("Production queue full"); return; }
  spendResources(gameState.resources, def.cost);
  productionBuilding.produceQueue.push(type);
  addNotification(`${def.name} queued`);
  addParticle(productionBuilding.x * TILE_SIZE + TILE_SIZE / 2, productionBuilding.y * TILE_SIZE + TILE_SIZE / 2, "#4CAF50", 8);
}

function updateMinimap() {
  const canvas = document.getElementById("minimapCanvas");
  const ctx = canvas.getContext("2d");
  const sx = canvas.width / MAP_WIDTH;
  const sy = canvas.height / MAP_HEIGHT;
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      ctx.fillStyle = tileColor(window.mapData[y][x]);
      ctx.fillRect(x * sx, y * sy, sx + 1, sy + 1);
    }
  }
  for (const b of gameState.buildings) {
    ctx.fillStyle = b.playerIndex === 0 ? "#f0c040" : PLAYER_COLORS[b.playerIndex] || "#888";
    ctx.fillRect(b.x * sx, b.y * sy, sx + 1, sy + 1);
  }
  for (const u of gameState.units) {
    if (!u.alive) continue;
    ctx.fillStyle = u.playerIndex === 0 ? "#4CAF50" : PLAYER_COLORS[u.playerIndex] || "#888";
    ctx.fillRect(u.x * sx, u.y * sy, sx + 1, sy + 1);
  }
  const visibleWidth = ctx.canvas.width / (gameState.camera.zoom * TILE_SIZE);
  const visibleHeight = ctx.canvas.height / (gameState.camera.zoom * TILE_SIZE);
  const camX = gameState.camera.x / TILE_SIZE;
  const camY = gameState.camera.y / TILE_SIZE;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect((camX - visibleWidth / 2) * sx, (camY - visibleHeight / 2) * sy, visibleWidth * sx, visibleHeight * sy);
}

function tileColor(tile) {
  switch (tile) {
    case TILE.GRASS: return "#4a7c3f";
    case TILE.SAND: return "#c2b280";
    case TILE.WATER: return "#2e6b9e";
    case TILE.FOREST: return "#2d5a27";
    case TILE.MOUNTAIN: return "#6b6b6b";
    default: return "#4a7c3f";
  }
}

window.updateUI = updateUI;
window.updateBuildButtons = updateBuildButtons;
window.setBuildMode = setBuildMode;
window.trainUnit = trainUnit;
window.updateMinimap = updateMinimap;
window.tileColor = tileColor;
window.initializeResourceEditor = initializeResourceEditor;