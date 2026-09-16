function updateResources(dt) {
  const buildings = gameState.buildings.filter(b => b.playerIndex === 0);
  for (const b of buildings) {
    if (b.type === "FARM") gameState.resources.food += dt * 2;
    if (b.type === "LUMBER_CAMP") gameState.resources.wood += dt * 1.5;
    if (b.type === "MINE") {
      gameState.resources.gold += dt * 1;
      gameState.resources.stone += dt * 0.5;
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
    unit.gatherTimer = 0;
    unit.gatherDone = true;
  }
}

window.updateResources = updateResources;
window.getWallet = getWallet;
window.collectResource = collectResource;