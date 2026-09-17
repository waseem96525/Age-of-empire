function updateUI() {
  const r = gameState.resources;
  const rates = getProductionRates ? getProductionRates() : { food: 0, wood: 0, gold: 0, stone: 0 };
  document.getElementById("food-val").textContent = Math.floor(r.food);
  document.getElementById("wood-val").textContent = Math.floor(r.wood);
  document.getElementById("gold-val").textContent = Math.floor(r.gold);
  document.getElementById("stone-val").textContent = Math.floor(r.stone);
  document.getElementById("pop-val").textContent = `${gameState.population}/${gameState.maxPopulation}`;
  const ageEl = document.getElementById("age-val");
  if (ageEl) ageEl.textContent = `Age ${AGES[gameState.age]?.name || "Dark"}`;
  const rateEls = ["food-rate", "wood-rate", "gold-rate", "stone-rate"];
  const rateKeys = ["food", "wood", "gold", "stone"];
  for (let i = 0; i < rateEls.length; i++) {
    const el = document.getElementById(rateEls[i]);
    if (el) el.textContent = "+" + rates[rateKeys[i]].toFixed(1) + "/s";
  }

  // Village status panel
  const vLevel = document.getElementById("village-lvl");
  const vXPFill = document.getElementById("village-xp-fill");
  const vPop = document.getElementById("village-pop");
  const vBuildings = document.getElementById("village-buildings");
  if (vLevel) vLevel.textContent = gameState.villageLevel;
  if (vXPFill) vXPFill.style.width = Math.min(100, (gameState.villageXP / gameState.nextLevelXP) * 100) + "%";
  if (vPop) vPop.textContent = `Pop: ${gameState.population}/${gameState.maxPopulation}`;
  if (vBuildings) vBuildings.textContent = `Buildings: ${gameState.buildingsBuilt}`;

  updateResourceEditor(r);
  const selectedInfo = document.getElementById("selected-info");
  const unitActions = document.getElementById("unit-actions");
  const formationControls = document.getElementById("formation-controls");
  const unitCounter = document.getElementById("unit-counter");

  // Unit counter
    if (unitCounter) {
      const counts = { peasant: 0, warrior: 0, archer: 0, samurai: 0, cavalry: 0, spearman: 0 };
      for (const u of gameState.units) {
        if (u.alive && u.playerIndex === 0) counts[u.type]++;
      }
      document.getElementById("unit-count-peasant").textContent = "P:" + counts.peasant;
      document.getElementById("unit-count-warrior").textContent = "W:" + counts.warrior;
      document.getElementById("unit-count-archer").textContent = "A:" + counts.archer;
      document.getElementById("unit-count-samurai").textContent = "S:" + counts.samurai;
      document.getElementById("unit-count-cavalry").textContent = "C:" + counts.cavalry;
      const spearmanEl = document.getElementById("unit-count-spearman");
      if (spearmanEl) spearmanEl.textContent = "SP:" + counts.spearman;
    }

  if (gameState.buildMode) {
    const def = BUILDINGS[gameState.buildMode];
    selectedInfo.innerHTML = `<h4>Build: ${def.name}</h4><p>Cost: ${formatCost(def.cost)}</p><p>Right-click to cancel</p>`;
    if (unitActions) unitActions.style.display = "none";
    if (formationControls) formationControls.style.display = "none";
  } else if (gameState.selectedUnits.length === 1) {
    const u = gameState.selectedUnits[0];
    const def = UNITS[u.type.toUpperCase()];
    const vetCost = window.getUpgradeCost ? window.getUpgradeCost(u.type, u.veteran + 1) : null;
    const canVet = u.veteran < 3 && vetCost && canAfford(gameState.resources, vetCost);
    const vetBtn = canVet
      ? `<button id="upgrade-unit-btn" class="action-btn" type="button">Upgrade to Veteran Lv.${u.veteran + 1} (${formatCost(vetCost)})</button>`
      : u.veteran >= 3
        ? `<button id="upgrade-unit-btn" class="action-btn disabled" type="button" disabled>Max Veteran Lv.3</button>`
        : `<button id="upgrade-unit-btn" class="action-btn disabled" type="button" disabled>Upgrade (${formatCost(vetCost)})</button>`;
    const garrisonBtn = `<button id="garrison-btn" class="action-btn" type="button">Garrison (G)</button>`;
    const stopBtn = `<button id="stop-btn" class="action-btn" type="button">Stop (H)</button>`;
    const vetDisplay = u.veteran > 0 ? "★".repeat(u.veteran) + " " : "";
    const specialUpgrades = [];
    if (u.type === "archer" && u.veteran < 3) {
      const flamingCost = getSpecialUpgradeCost("archer", "flaming-arrows");
      if (flamingCost && canAfford(gameState.resources, flamingCost)) {
        specialUpgrades.push(`<button class="action-btn" onclick="window.upgradeUnitSpecial(u, 'flaming-arrows')">Flaming Arrows (${formatCost(flamingCost)})</button>`);
      }
    }
    if (u.type === "warrior" && u.veteran < 3) {
      const plateCost = getSpecialUpgradeCost("warrior", "plate-armor");
      if (plateCost && canAfford(gameState.resources, plateCost)) {
        specialUpgrades.push(`<button class="action-btn" onclick="window.upgradeUnitSpecial(u, 'plate-armor')">Plate Armor (${formatCost(plateCost)})</button>`);
      }
    }
    if (u.type === "cavalry" && u.veteran < 3) {
      const horseshoeCost = getSpecialUpgradeCost("cavalry", "horseshoes");
      if (horseshoeCost && canAfford(gameState.resources, horseshoeCost)) {
        specialUpgrades.push(`<button class="action-btn" onclick="window.upgradeUnitSpecial(u, 'horseshoes')">Horseshoes (${formatCost(horseshoeCost)})</button>`);
      }
    }
    if (u.type === "samurai" && u.veteran < 3) {
      const stanceCost = getSpecialUpgradeCost("samurai", "samurai-stance");
      if (stanceCost && canAfford(gameState.resources, stanceCost)) {
        specialUpgrades.push(`<button class="action-btn" onclick="window.upgradeUnitSpecial(u, 'samurai-stance')">New Stance (${formatCost(stanceCost)})</button>`);
      }
    }
    selectedInfo.innerHTML = `<h4>${def.symbol} ${def.name} ${vetDisplay}</h4><p>HP: ${Math.floor(u.hp)}/${u.maxHp}</p><p>ATK: ${u.attack} | ARM: ${u.armor}</p><p>Range: ${u.range}</p><p>Task: ${u.task}</p>${vetBtn}${garrisonBtn}${stopBtn}<div style="margin-top:8px;">${specialUpgrades.join(" ")}</div>`;
    if (unitActions) unitActions.style.display = "flex";
    if (formationControls) formationControls.style.display = "flex";
  } else if (gameState.selectedUnits.length > 1) {
    const vetCount = gameState.selectedUnits.filter(u => u.veteran < 3).length;
    selectedInfo.innerHTML = `<h4>${gameState.selectedUnits.length} Units Selected</h4><p>${vetCount} can be upgraded</p>`;
    if (unitActions) unitActions.style.display = "none";
    if (formationControls) formationControls.style.display = "flex";
  } else if (gameState.selectedBuilding) {
    const b = gameState.selectedBuilding;
    const def = BUILDINGS[b.type];
    const rallyHint = def.produces.length > 0 ? "<p>Right-click map to set rally point</p>" : "";
    let upgradeHtml = "";
    if (b.level < 3 && b.playerIndex === 0) {
      const levelMult = 1 + (b.level - 1) * 0.5;
      const uc = {
        food: Math.round(b.upgradeCost.food * levelMult),
        wood: Math.round(b.upgradeCost.wood * levelMult),
        gold: Math.round(b.upgradeCost.gold * levelMult),
        stone: Math.round(b.upgradeCost.stone * levelMult)
      };
      const canUp = canAfford(gameState.resources, uc) && b.level < 3;
      upgradeHtml = `<p><button id="upgrade-building-btn" class="action-btn ${canUp ? '' : 'disabled'}" ${canUp ? '' : 'disabled'}>Upgrade to Lv.${b.level + 1} (${formatCost(uc)})</button></p>`;
    }
    let techHtml = "";
    if (b.type === "TOWN_CENTER" && b.playerIndex === 0) {
      techHtml = "<p><strong>Research:</strong></p>";
      const techNames = { food: "Crop Rotation", wood: "Efficient Logging", gold: "Mining Techniques", stone: "Quarrying" };
      const techCost = [
        { food: 100, wood: 50, gold: 50, stone: 25 },
        { food: 200, wood: 100, gold: 100, stone: 75 },
        { food: 400, wood: 200, gold: 200, stone: 150 }
      ];
      const techKeys = ["food", "wood", "gold", "stone"];
      for (const tk of techKeys) {
        const tl = (gameState.techLevels || { food: 0, wood: 0, gold: 0, stone: 0 })[tk] || 0;
        if (tl < 3) {
          const tc = techCost[tl];
          const canRes = canAfford(gameState.resources, tc);
          techHtml += `<button class="tech-btn ${canRes ? '' : 'disabled'}" data-tech="${tk}" ${canRes ? '' : 'disabled'}>${techNames[tk]} Lv.${tl}→${tl + 1} (${formatCost(tc)})</button> `;
        }
      }
    }
    selectedInfo.innerHTML = `<h4>${def.name} Lv.${b.level}</h4><p>HP: ${Math.floor(b.hp)}/${b.maxHp}</p><p>Queue: ${b.produceQueue.length > 0 ? UNITS[b.produceQueue[0].toUpperCase()].name : "Empty"}</p>${rallyHint}${upgradeHtml}${techHtml}`;
    if (unitActions) unitActions.style.display = "none";
  } else {
    selectedInfo.innerHTML = `<h4>No Selection</h4><p>Click units or buildings to select</p>`;
    if (unitActions) unitActions.style.display = "none";
    if (formationControls) formationControls.style.display = "none";
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
  const types = ["TOWN_CENTER", "HOUSE", "BARRACKS", "FARM", "LUMBER_CAMP", "MINE", "WALL", "STABLE"];
  const unitTypes = ["peasant", "samurai", "archer", "cavalry", "warrior", "spearman"];

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
  Sound.playTrain();
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

document.addEventListener("click", (e) => {
  const upgradeBtn = e.target.closest("#upgrade-building-btn");
  if (upgradeBtn && gameState.selectedBuilding) {
    const b = gameState.selectedBuilding;
    if (b.level < 3) {
      const levelMult = 1 + (b.level - 1) * 0.5;
      const cost = {
        food: Math.round(b.upgradeCost.food * levelMult),
        wood: Math.round(b.upgradeCost.wood * levelMult),
        gold: Math.round(b.upgradeCost.gold * levelMult),
        stone: Math.round(b.upgradeCost.stone * levelMult)
      };
      if (canAfford(gameState.resources, cost)) {
        if (window.upgradeBuilding && window.upgradeBuilding(b)) {
          updateUI();
        }
      }
    }
    return;
  }
  const techBtn = e.target.closest(".tech-btn");
  if (techBtn) {
    const resType = techBtn.dataset.tech;
    if (resType && window.researchTech) {
      if (window.researchTech(resType)) {
        updateUI();
      }
    }
    return;
  }
});