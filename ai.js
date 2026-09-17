function initAI(playerIndex) {
  const ai = {
    playerIndex,
    resources: { food: 300, wood: 200, gold: 150, stone: 100 },
    population: 0,
    maxPopulation: 100,
    buildings: [],
    units: [],
    baseX: playerIndex === 1 ? 8 : 31,
    baseY: playerIndex === 1 ? 31 : playerIndex === 2 ? 8 : 31,
    buildTimer: 0,
    attackTimer: 0,
    strategy: "balanced"
  };
  gameState.aiPlayers.push(ai);
  const tc = createBuilding("TOWN_CENTER", ai.baseX, ai.baseY, playerIndex, ai.resources);
  if (tc) {
    tc.produceQueue.push("peasant");
    ai.buildings.push(tc);
    gameState.buildings.push(tc);
  }
  for (let i = 0; i < 5; i++) {
    const unit = createUnit("peasant", ai.baseX + (Math.random() - 0.5) * 2, ai.baseY + (Math.random() - 0.5) * 2, playerIndex, ai.resources, ai, true);
    if (unit) {
      ai.units.push(unit);
      gameState.units.push(unit);
      ai.population += unit.pop;
    }
  }
}

function aiTrain(ai, type, building) {
  const unitDef = UNITS[type.toUpperCase()];
  if (!unitDef || !building) return false;
  const unit = createUnit(type, building.x + (Math.random() - 0.5), building.y + (Math.random() - 0.5), ai.playerIndex, ai.resources, ai);
  if (!unit) return false;
  ai.units.push(unit);
  gameState.units.push(unit);
  ai.population += unit.pop;
  return true;
}

function updateAI(dt) {
  for (const ai of gameState.aiPlayers) {
    const aiBuildings = ai.buildings.filter(b => b.hp > 0);
    const aiUnits = ai.units.filter(u => u.alive);
    const tc = aiBuildings.find(b => b.type === "TOWN_CENTER");
    const barracks = aiBuildings.find(b => b.type === "BARRACKS");
    const stable = aiBuildings.find(b => b.type === "STABLE");
    const farm = aiBuildings.find(b => b.type === "FARM");
    const lumber = aiBuildings.find(b => b.type === "LUMBER_CAMP");
    const mine = aiBuildings.find(b => b.type === "MINE");
    if (farm) ai.resources.food += dt * 2;
    if (lumber) ai.resources.wood += dt * 1.5;
    if (mine) { ai.resources.gold += dt * 1; ai.resources.stone += dt * 0.5; }
    ai.buildTimer += dt;
    if (ai.buildTimer > 6) {
      ai.buildTimer = 0;
      const count = aiBuildings.length;
      if (count < 4 && ai.resources.food >= 100 && ai.resources.wood >= 100 && isBuildable(ai.baseX + 3, ai.baseY + 3)) {
        const b = createBuilding("BARRACKS", ai.baseX + 3, ai.baseY + 3, ai.playerIndex, ai.resources);
        if (b) { ai.buildings.push(b); gameState.buildings.push(b); }
      }
      if (count < 5 && ai.resources.wood >= 100 && isBuildable(ai.baseX - 3, ai.baseY + 3)) {
        const b = createBuilding("LUMBER_CAMP", ai.baseX - 3, ai.baseY + 3, ai.playerIndex, ai.resources);
        if (b) { ai.buildings.push(b); gameState.buildings.push(b); }
      }
      if (count < 6 && ai.resources.gold >= 100 && ai.resources.stone >= 100 && isBuildable(ai.baseX + 3, ai.baseY - 3)) {
        const b = createBuilding("MINE", ai.baseX + 3, ai.baseY - 3, ai.playerIndex, ai.resources);
        if (b) { ai.buildings.push(b); gameState.buildings.push(b); }
      }
      if (count < 7 && ai.resources.food >= 50 && ai.resources.wood >= 100 && isBuildable(ai.baseX - 3, ai.baseY - 3)) {
        const b = createBuilding("FARM", ai.baseX - 3, ai.baseY - 3, ai.playerIndex, ai.resources);
        if (b) { ai.buildings.push(b); gameState.buildings.push(b); }
      }
    }
    if (tc && tc.produceQueue.length < 3) {
      const hasPeasant = tc.produceQueue.some(q => q === "peasant");
      if (!hasPeasant && ai.resources.food >= 50 && ai.population < ai.maxPopulation) {
        tc.produceQueue.push("peasant");
      }
    }
    const queues = [tc, barracks, stable].filter(Boolean);
    for (const q of queues) {
      if (!q || q.produceQueue.length === 0) continue;
      const type = q.produceQueue[0];
      q.produceTimer += dt;
      const buildTime = type === "peasant" ? 10 : 15;
      if (q.produceTimer >= buildTime) {
        q.produceQueue.shift();
        q.produceTimer = 0;
        const target = q === tc ? "peasant" : type;
        const unitDef = UNITS[target.toUpperCase()];
        if (target !== "peasant" && ai.resources.food < unitDef.cost.food + 50) continue;
        if (aiTrain(ai, target, q)) addNotification(`${PLAYER_NAMES[ai.playerIndex]} trained ${unitDef.name}`);
      }
    }
    if (ai.buildTimer > 12) {
      ai.buildTimer = 0;
      const enemyUnits = gameState.units.filter(u => u.playerIndex === 0 && u.alive);
      const enemyBuildings = gameState.buildings.filter(b => b.playerIndex === 0 && b.hp > 0);
      if (enemyUnits.length > 0 || enemyBuildings.length > 0) {
        const target = enemyUnits[Math.floor(Math.random() * enemyUnits.length)] || enemyBuildings[Math.floor(Math.random() * enemyBuildings.length)];
        const attackers = aiUnits.filter(u => u.type !== "peasant").slice(0, 5);
        const targetType = gameState.units.includes(target) ? "unit" : "building";
        for (const attacker of attackers) {
          if (target.playerIndex === 0) unitAttack(attacker, targetType, target.id);
        }
      }
    }
    for (const u of aiUnits) {
      if (u.type !== "peasant") continue;
      const res = findNearestResource(u.x, u.y, null);
      if (res) {
        unitGather(u, res.type);
        u.targetX = res.x;
        u.targetY = res.y;
      }
    }
  }
}

function checkGameOver() {
  const playerTC = gameState.buildings.find(b => b.playerIndex === 0 && b.type === "TOWN_CENTER");
  if (!playerTC || playerTC.hp <= 0) {
    gameState.gameOver = true;
    gameState.winner = "defeat";
    Sound.resume();
    Sound.playDefeat();
    const overText = document.getElementById("game-over-text");
    if (overText) overText.textContent = "Defeat!";
    document.getElementById("game-over-screen").classList.remove("hidden");
    return;
  }
  const allEnemiesDefeated = gameState.aiPlayers.every(ai => {
    const aiTC = ai.buildings.find(b => b.type === "TOWN_CENTER");
    return !aiTC || aiTC.hp <= 0;
  });
  if (allEnemiesDefeated) {
    gameState.gameOver = true;
    gameState.winner = "victory";
    addNotification("Victory: enemy dynasties defeated");
    Sound.resume();
    Sound.playVictory();
    const overText = document.getElementById("game-over-text");
    if (overText) overText.textContent = "Victory!";
    document.getElementById("game-over-screen").classList.remove("hidden");
  }
}

window.initAI = initAI;
window.updateAI = updateAI;
window.checkGameOver = checkGameOver;
window.aiTrain = aiTrain;