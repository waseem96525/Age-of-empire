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

const TECH_TREE = {
  "Crop Rotation": {
    id: "Crop Rotation",
    age: 0,
    cost: { food: 100, wood: 50, gold: 50, stone: 25 },
    requirements: {},
    effects: {
      foodProduction: 0.25
    },
    description: "Increases farm food production by 25%"
  },
  "Efficient Logging": {
    id: "Efficient Logging",
    age: 0,
    cost: { food: 100, wood: 50, gold: 50, stone: 25 },
    requirements: {},
    effects: {
      woodProduction: 0.25
    },
    description: "Increases lumber camp wood production by 25%"
  },
  "Mining Techniques": {
    id: "Mining Techniques",
    age: 0,
    cost: { food: 100, wood: 50, gold: 50, stone: 25 },
    requirements: {},
    effects: {
      goldProduction: 0.25,
      stoneProduction: 0.125
    },
    description: "Increases mine gold and stone production by 25%/12.5%"
  },
  "Quarrying": {
    id: "Quarrying",
    age: 0,
    cost: { food: 100, wood: 50, gold: 50, stone: 25 },
    requirements: {},
    effects: {
      stoneProduction: 0.25
    },
    description: "Increases mine stone production by 25%"
  },
  "Iron Working": {
    id: "Iron Working",
    age: 1,
    cost: { food: 200, wood: 150, gold: 150, stone: 100 },
    requirements: { "Mining Techniques": 1 },
    effects: {
      warriorAttack: 0.3,
      swordsmanUnlock: true
    },
    description: "Unlocks Warrior unit and increases attack by 30%"
  },
  "Archery": {
    id: "Archery",
    age: 1,
    cost: { food: 150, wood: 100, gold: 100, stone: 50 },
    requirements: {},
    effects: {
      archerRange: 0.5,
      archerAttack: 0.2
    },
    description: "Increases Archer range by 0.5 and attack by 20%"
  },
  "Stable Mastery": {
    id: "Stable Mastery",
    age: 1,
    cost: { food: 150, wood: 100, gold: 100, stone: 50 },
    requirements: {},
    effects: {
      cavalrySpeed: 0.15,
      cavalryAttack: 0.2
    },
    description: "Increases Cavalry speed by 15% and attack by 20%"
  },
  "Squireship": {
    id: "Squireship",
    age: 2,
    cost: { food: 400, wood: 300, gold: 400, stone: 200 },
    requirements: { "Iron Working": 3 },
    effects: {
      warriorAttack: 0.5,
      veteranXP: 0.2
    },
    description: "Warriors gain veteran XP 20% faster and +50% attack"
  },
  "Ballistics": {
    id: "Ballistics",
    age: 2,
    cost: { food: 300, wood: 200, gold: 300, stone: 150 },
    requirements: { Archery: 3 },
    effects: {
      archerDamage: 0.3
    },
    description: "Archers deal 30% more damage"
  },
  "Horse Collar": {
    id: "Horse Collar",
    age: 2,
    cost: { food: 200, wood: 150, gold: 150, stone: 100 },
    requirements: { "Stable Mastery": 3 },
    effects: {
      farmProduction: 0.2
    },
    description: "Farms produce 20% more food"
  },
  "Supplies": {
    id: "Supplies",
    age: 3,
    cost: { food: 500, wood: 400, gold: 500, stone: 300 },
    requirements: { "Squireship": 3, "Ballistics": 3, "Horse Collar": 3 },
    effects: {
      allProduction: 0.15
    },
    description: "All resource production increased by 15%"
  }
};

function getTechLevel(resType) {
  return gameState.techLevels && gameState.techLevels[resType] || 0;
}

function getTechEffect(effectName) {
  const tech = gameState.techLevels || {};
  const effects = {
    foodProduction: 0.25 * (tech.food || 0),
    woodProduction: 0.25 * (tech.wood || 0),
    goldProduction: 0.25 * (tech.gold || 0),
    stoneProduction: 0.125 * (tech.stone || 0),
    warriorAttack: 0.3 * (tech.warrior || 0 || 0),
    archerRange: 0.5 * (tech.archer || 0 || 0),
    archerAttack: 0.2 * (tech.archer || 0 || 0),
    cavalrySpeed: 0.15 * (tech.cavalry || 0 || 0),
    cavalryAttack: 0.2 * (tech.cavalry || 0 || 0),
    veteranXP: 0.2 * (tech.veteran || 0 || 0),
    archerDamage: 0.3 * (tech.archer || 0 || 0),
    allProduction: 0.15 * (tech.all || 0 || 0)
  };
  return effects[effectName] || 0;
}

function researchTech(resType) {
  if (!resType) return false;
  const tech = gameState.techLevels || { food: 0, wood: 0, gold: 0, stone: 0 };
  const current = tech[resType] || 0;
  if (current >= 3) return false;

  const techEntry = Object.values(TECH_TREE).find(t => t.id === resType);
  if (!techEntry) return false;

  const age = techEntry.age || 0;
  const ageCheck = (gameState.villageLevel || 1) - 1;
  if (age > ageCheck) {
    addNotification(`Technology requires Age ${age + 1}`);
    return false;
  }

  const cost = techEntry.cost;
  if (!canAfford(gameState.resources, cost)) return false;

  // Check requirements
  for (const [reqTech, reqLevel] of Object.entries(techEntry.requirements || {})) {
    if ((gameState.techLevels || {})[reqTech] < reqLevel) {
      addNotification(`Requires ${reqTech} Lv.${reqLevel}`);
      return false;
    }
  }

  spendResources(gameState.resources, cost);
  tech[resType] = current + 1;
  gameState.techLevels = tech;
  
  const names = {
    food: "Crop Rotation",
    wood: "Efficient Logging",
    gold: "Mining Techniques",
    stone: "Quarrying",
    IronWorking: "Iron Working",
    Archery: "Archery",
    StableMastery: "Stable Mastery",
    Squireship: "Squireship",
    Ballistics: "Ballistics",
    HorseCollar: "Horse Collar",
    Supplies: "Supplies"
  };

  addNotification(`${names[resType] || resType} researched! (Lv.${tech[resType]})`);
  
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
window.TECH_TREE = TECH_TREE;
window.getTechLevel = getTechLevel;
window.getTechEffect = getTechEffect;