function getProductionMultiplier() {
  const tech = gameState.techLevels || { food: 0, wood: 0, gold: 0, stone: 0 };
  const techBonus = 1 + 0.25 * Math.max(0, Math.min(3, tech.food));
  return techBonus;
}

function getResourceProductionRates() {
  const buildings = gameState.buildings.filter(b => b.playerIndex === 0);
  const tech = gameState.techLevels || { food: 0, wood: 0, gold: 0, stone: 0 };
  const rates = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const b of buildings) {
    const levelMult = 1 + (b.level - 1) * 0.3;
    if (b.type === "FARM") rates.food += 2 * levelMult;
    if (b.type === "LUMBER_CAMP") rates.wood += 1.5 * levelMult;
    if (b.type === "MINE") {
      rates.gold += 1 * levelMult;
      rates.stone += 0.5 * levelMult;
    }
  }
  rates.food *= 1 + 0.25 * Math.max(0, Math.min(3, tech.food));
  rates.wood *= 1 + 0.25 * Math.max(0, Math.min(3, tech.wood));
  rates.gold *= 1 + 0.25 * Math.max(0, Math.min(3, tech.gold));
  rates.stone *= 1 + 0.25 * Math.max(0, Math.min(3, tech.stone));
  return rates;
}

function updateResources(dt) {
  const villageBonus = gameState.villageLevel ? (1 + (gameState.villageLevel - 1) * 0.05) : 1;
  const buildings = gameState.buildings.filter(b => b.playerIndex === 0);
  for (const b of buildings) {
    const levelMult = 1 + (b.level - 1) * 0.3;
    if (b.type === "FARM") gameState.resources.food += dt * 2 * levelMult * villageBonus;
    if (b.type === "LUMBER_CAMP") gameState.resources.wood += dt * 1.5 * levelMult * villageBonus;
    if (b.type === "MINE") {
      gameState.resources.gold += dt * 1 * levelMult * villageBonus;
      gameState.resources.stone += dt * 0.5 * levelMult * villageBonus;
    }
  }
  const workers = gameState.units.filter(u => u.playerIndex === 0 && u.task === "gather" && u.gatherType);
  for (const u of workers) {
    if (u.gatherTimer > 0) continue;
    const dx = u.targetX - u.x;
    const dy = u.targetY - u.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1.5) {
      collectResource(u);
    }
  }
}

function getWallet(playerIndex) {
  if (playerIndex === 0) return gameState.resources;
  const ai = gameState.aiPlayers.find(a => a.playerIndex === playerIndex);
  return ai ? ai.resources : null;
}

function collectResource(unit) {
  if (!unit || !unit.gatherType) return;
  const wallet = getWallet(unit.playerIndex);
  if (!wallet) return;
  const node = gameState.resourcesOnMap.find(r =>
    r.type === unit.gatherType && !r.depleted && distance(unit.x, unit.y, r.x, r.y) < 1.5
  );
  if (node) {
    node.amount--;
    if (node.amount <= 0) node.depleted = true;
    wallet[unit.gatherType] += 1;
    Sound.playCollect();
    unit.gatherTimer = 0;
    unit.gatherDone = true;
  }
}

function researchTech(resType) {
  if (!resType) return false;
  const tech = gameState.techLevels || { food: 0, wood: 0, gold: 0, stone: 0 };
  const current = tech[resType] || 0;
  if (current >= 3) return false;
  const costs = [
    { food: 100, wood: 50, gold: 50, stone: 25 },
    { food: 200, wood: 100, gold: 100, stone: 75 },
    { food: 400, wood: 200, gold: 200, stone: 150 }
  ];
  const cost = costs[current];
  if (!canAfford(gameState.resources, cost)) return false;
  spendResources(gameState.resources, cost);
  tech[resType] = current + 1;
  gameState.techLevels = tech;
  const names = { food: "Crop Rotation", wood: "Efficient Logging", gold: "Mining Techniques", stone: "Quarrying" };
  addNotification(`${names[resType]} researched! (Lv.${tech[resType]})`);
  const tc = gameState.buildings.find(b => b.type === "TOWN_CENTER" && b.playerIndex === 0);
  if (tc) addParticle(tc.x * TILE_SIZE + TILE_SIZE / 2, tc.y * TILE_SIZE + TILE_SIZE / 2, "#f0c040", 25);
  Sound.playTrain();
  return true;
}

window.updateResources = updateResources;
window.getWallet = getWallet;
window.collectResource = collectResource;
window.getProductionRates = getResourceProductionRates;
window.researchTech = researchTech;
window.getProductionMultiplier = getProductionMultiplier;