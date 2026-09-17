function createUnit(type, x, y, playerIndex, wallet, popObj, isFree = false) {
  const unitDef = UNITS[type.toUpperCase()];
  if (!unitDef) return null;
  const w = wallet || gameState.resources;
  const p = popObj || gameState;
  if (!isFree && !canAfford(w, unitDef.cost)) return null;
  if (playerIndex === 0 && p.population + unitDef.pop > p.maxPopulation) return null;
  if (!isFree) spendResources(w, unitDef.cost);
  const unit = {
    type: type.toLowerCase(),
    x, y,
    playerIndex,
    hp: unitDef.hp,
    maxHp: unitDef.hp,
    attack: unitDef.attack,
    armor: unitDef.armor,
    speed: unitDef.speed,
    range: unitDef.range,
    pop: unitDef.pop,
    targetX: x, targetY: y,
    task: "idle",
    attackTarget: null,
    attackType: null,
    gatherType: null,
    gatherTimer: 0,
    gatherDone: false,
    homeX: x, homeY: y,
    movePath: null,
    movePathIndex: 0,
    attackTimer: 0,
    id: Date.now() + Math.random(),
    alive: true,
    symbol: unitDef.symbol,
    color: unitDef.color,
    // Enhanced: animation frame counter
    animFrame: 0,
    // Enhanced: squish animation for attacks
    squish: 0,
    commandQueue: [],
    // Veteran level system (0-3)
    veteran: 0,
    // Garrison system
    garrisonedIn: null,
    // Combat feedback
    lastDamage: 0,
    lastDamageTime: 0,
    // Movement animation
    facing: 0
  };
  if (unit.type === "peasant") {
    unit.gatherType = "food";
    unit.task = "gather";
    const res = findNearestResource(x, y, "food");
    if (res) { unit.targetX = res.x; unit.targetY = res.y; }
  }
  return unit;
}

// Upgrade a unit to veteran level (costs resources, increases stats)
function upgradeUnit(unit) {
  if (!unit || !unit.alive || unit.veteran >= 3) return false;
  const cost = getUpgradeCost(unit.type, unit.veteran + 1);
  if (!canAfford(gameState.resources, cost)) return false;
  spendResources(gameState.resources, cost);
  unit.veteran++;
  const bonus = 1 + unit.veteran * 0.15; // 15% per level
  unit.hp = Math.floor(UNITS[unit.type.toUpperCase()].hp * bonus);
  unit.maxHp = unit.hp;
  unit.attack = Math.floor(UNITS[unit.type.toUpperCase()].attack * bonus);
  unit.armor = Math.floor(UNITS[unit.type.toUpperCase()].armor * bonus);
  unit.speed *= 1.05;
  addNotification(`${UNITS[unit.type.toUpperCase()].name} promoted to Veteran Lv.${unit.veteran}`);
  addParticle(unit.x * TILE_SIZE + TILE_SIZE / 2, unit.y * TILE_SIZE + TILE_SIZE / 2, "#ffd700", 20);
  Sound.playTrain();
  return true;
}

function getUpgradeCost(type, level) {
  const def = UNITS[type.toUpperCase()];
  if (!def) return null;
  const base = def.cost;
  return {
    food: Math.round(base.food * 0.4 * level),
    wood: Math.round((base.wood || 0) * 0.4 * level),
    gold: Math.round((base.gold || 0) * 0.4 * level),
    stone: Math.round((base.stone || 0) * 0.4 * level)
  };
}

// Garrison a unit into a building for defense
function garrisonUnit(unit, buildingId) {
  if (!unit || !unit.alive) return false;
  const building = gameState.buildings.find(b => b.id === buildingId);
  if (!building || building.playerIndex !== unit.playerIndex) return false;
  if (building.garrisonCount === undefined) building.garrisonCount = 0;
  if (building.garrisonCount >= 5) { addNotification("Building garrison is full"); return false; }
  building.garrisonCount++;
  unit.garrisonedIn = buildingId;
  unit.alive = false;
  // Boost building attack
  building.garrisonAttack = (building.garrisonAttack || 0) + unit.attack;
  addNotification(`${UNITS[unit.type.toUpperCase()].name} garrisoned`);
  addParticle(building.x * TILE_SIZE + TILE_SIZE / 2, building.y * TILE_SIZE + TILE_SIZE / 2, "#4CAF50", 10);
  Sound.playTrain();
  return true;
}

// Release a garrisoned unit
function ungarrison(building) {
  if (!building || !building.garrisonCount || building.garrisonCount <= 0) return;
  const released = [];
  for (const u of gameState.units) {
    if (u.garrisonedIn === building.id && !u.alive) {
      u.alive = true;
      u.x = building.x + (Math.random() - 0.5) * 2;
      u.y = building.y + (Math.random() - 0.5) * 2;
      building.garrisonAttack = Math.max(0, (building.garrisonAttack || 0) - u.attack);
      building.garrisonCount--;
      released.push(u);
    }
  }
  if (released.length > 0) {
    addNotification(`Released ${released.length} garrisoned unit(s)`);
  }
}

// Floating damage text
function addDamageText(x, y, damage, isCrit) {
  gameState.floatTexts = gameState.floatTexts || [];
  gameState.floatTexts.push({
    x, y,
    text: Math.floor(damage),
    life: 1,
    color: isCrit ? "#ff4444" : "#ffffff",
    vy: -2
  });
}

// Projectile system for archers
function addProjectile(fromX, fromY, toX, toY, color, damage, targetId, sourceId) {
  gameState.projectiles = gameState.projectiles || [];
  gameState.projectiles.push({
    fromX, fromY, toX, toY,
    x: fromX, y: fromY,
    color, damage,
    targetId, sourceId,
    speed: 6,
    life: 1
  });
}

function updateProjectiles(dt) {
  if (!gameState.projectiles) return;
  gameState.projectiles = gameState.projectiles.filter(p => {
    const dx = p.toX - p.x;
    const dy = p.toY - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.3) {
      // Hit target
      const target = gameState.units.find(u => u.id === p.targetId);
      if (target && target.alive) {
        target.hp -= p.damage;
        addDamageText(target.x, target.y, p.damage, false);
        addParticle(target.x * TILE_SIZE + TILE_SIZE / 2, target.y * TILE_SIZE + TILE_SIZE / 2, "#ff9800", 4);
        if (target.hp <= 0) {
          target.alive = false;
          gameState.population -= target.pop;
          addNotification(`${UNITS[target.type.toUpperCase()].name} destroyed`);
          Sound.playDeath();
        }
      }
      return false;
    }
    p.x += dx / dist * p.speed * dt;
    p.y += dy / dist * p.speed * dt;
    p.life -= dt * 2;
    return p.life > 0;
  });
}

function renderProjectiles(ctx) {
  if (!gameState.projectiles) return;
  for (const p of gameState.projectiles) {
    const pos = getWorldToScreen(p.x, p.y);
    const ts = TILE_SIZE * gameState.camera.zoom;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, Math.max(2, ts * 0.06), 0, Math.PI * 2);
    ctx.fill();
    // Trail
    ctx.fillStyle = p.color + "80";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, Math.max(1, ts * 0.03), 0, Math.PI * 2);
    ctx.fill();
  }
}

function findNearestResource(x, y, type) {
  let best = null, bestDist = Infinity;
  for (const r of gameState.resourcesOnMap) {
    if (r.depleted || (type && r.type !== type)) continue;
    const d = distance(x, y, r.x, r.y);
    if (d < bestDist) { bestDist = d; best = r; }
  }
  return best;
}

function updateUnits(dt) {
  for (const u of gameState.units) {
    if (!u.alive) continue;
    u.attackTimer = Math.max(0, u.attackTimer - dt);
    u.gatherTimer = Math.max(0, u.gatherTimer - dt);
    u.animFrame += dt * 8; // Animation speed

    // Squish recovery
    u.squish = Math.max(0, u.squish - dt * 3);

    // Bleed effect (samurai DoT)
    if (u.bleedTimer > 0) {
      u.bleedTimer -= dt;
      u.hp -= 2;
      if (u.hp <= 0) u.alive = false;
    }

    if (u.playerIndex === 0) {
      if (u.task === "gather" && u.gatherType) {
        const dx = u.targetX - u.x;
        const dy = u.targetY - u.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1.2) {
          if (u.gatherDone === false) collectResource(u);
          const next = findNearestResource(u.x, u.y, u.gatherType);
          if (next) { u.targetX = next.x; u.targetY = next.y; u.gatherDone = false; }
          else { u.task = "idle"; u.gatherType = null; advanceCommand(u); }
        } else {
          u.x += dx / dist * u.speed * dt;
          u.y += dy / dist * u.speed * dt;
        }
      } else if (u.task === "repair" && u.attackTarget) {
        const target = gameState.buildings.find(b => b.id === u.attackTarget && b.playerIndex === u.playerIndex);
        if (!target || target.hp >= target.maxHp) {
          u.attackTarget = null;
          u.task = "idle";
          continue;
        }
        const dx = target.x - u.x;
        const dy = target.y - u.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= 1.15) {
          if (u.gatherTimer <= 0) {
            if (gameState.resources.wood > 0) {
              target.hp = Math.min(target.maxHp, target.hp + 10);
              gameState.resources.wood--;
              addParticle(target.x * TILE_SIZE + TILE_SIZE / 2, target.y * TILE_SIZE + TILE_SIZE / 2, "#e1be69", 3);
            } else {
              addNotification("Not enough wood to repair");
              u.task = "idle";
              u.attackTarget = null;
              advanceCommand(u);
            }
            u.gatherTimer = 0.75;
          }
        } else {
          u.x += dx / dist * u.speed * dt;
          u.y += dy / dist * u.speed * dt;
        }
      } else if (u.task === "attack" && u.attackTarget) {
        const targetUnit = gameState.units.find(v => v.id === u.attackTarget && v.alive);
        const targetBuilding = gameState.buildings.find(b => b.id === u.attackTarget);
        const target = targetUnit || targetBuilding;
        if (!target) { u.attackTarget = null; u.attackType = null; u.task = "idle"; advanceCommand(u); continue; }
        const dx = target.x - u.x;
        const dy = target.y - u.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const effectiveRange = u.type === "archer" ? u.range + 0.5 : u.range + 0.5;
        if (dist <= effectiveRange) {
          if (u.attackTimer <= 0) {
            // Archer: ranged projectile attack
            if (u.type === "archer") {
              const dmg = Math.max(1, u.attack - (target.armor || 0));
              addProjectile(u.x, u.y, target.x, target.y, "#8B4513", dmg, target.id, u.id);
              u.attackTimer = 0.8;
              u.squish = 0.15;
              addParticle(u.x * TILE_SIZE + TILE_SIZE / 2, u.y * TILE_SIZE + TILE_SIZE / 2, "#ff9800", 3);
            }
            // Samurai: melee with bleed
            else if (u.type === "samurai") {
              let dmg = Math.max(1, u.attack - (target.armor || 0));
              let isCrit = Math.random() < 0.2 + u.veteran * 0.05;
              if (isCrit) dmg = Math.floor(dmg * 2.5);
              target.hp -= dmg;
              target.bleedTimer = (target.bleedTimer || 0) + 3;
              u.attackTimer = 1;
              u.squish = 0.3;
              addDamageText(target.x, target.y, dmg, isCrit);
              addParticle(target.x * TILE_SIZE + TILE_SIZE / 2, target.y * TILE_SIZE + TILE_SIZE / 2, isCrit ? "#ff4444" : "#C41E3A", isCrit ? 12 : 6);
              if (target.hp <= 0) {
                if (targetUnit) { targetUnit.alive = false; gameState.population -= targetUnit.pop; }
                if (targetBuilding) { targetBuilding.hp = 0; }
                addNotification(`${targetUnit ? UNITS[targetUnit.type.toUpperCase()].name : BUILDINGS[targetBuilding.type].name} destroyed`);
                Sound.playDeath();
              }
            }
            // Cavalry: charge attack with knockback and splash
            else if (u.type === "cavalry") {
              let dmg = Math.max(1, u.attack * 1.3 - (target.armor || 0)); // bonus vs infantry
              target.hp -= dmg;
              // Splash to nearby enemies
              for (const other of gameState.units) {
                if (other.playerIndex !== u.playerIndex && other.alive && other.id !== target.id) {
                  if (distance(other.x, other.y, target.x, target.y) < 1.0) {
                    other.hp -= Math.floor(dmg * 0.5);
                    addDamageText(other.x, other.y, Math.floor(dmg * 0.5), false);
                    if (other.hp <= 0) other.alive = false;
                  }
                }
              }
              u.attackTimer = 1.2;
              u.squish = 0.4;
              addDamageText(target.x, target.y, Math.floor(dmg), false);
              addParticle(target.x * TILE_SIZE + TILE_SIZE / 2, target.y * TILE_SIZE + TILE_SIZE / 2, "#4169E1", 8);
              if (target.hp <= 0) {
                if (targetUnit) { targetUnit.alive = false; gameState.population -= targetUnit.pop; }
                if (targetBuilding) { targetBuilding.hp = 0; }
                addNotification(`${targetUnit ? UNITS[targetUnit.type.toUpperCase()].name : BUILDINGS[targetBuilding.type].name} destroyed`);
                Sound.playDeath();
              }
            }
            // Warrior: basic melee
            else {
              let dmg = Math.max(1, u.attack - (target.armor || 0));
              let isCrit = Math.random() < 0.12;
              if (isCrit) dmg = Math.floor(dmg * 1.8);
              target.hp -= dmg;
              u.attackTimer = 1;
              u.squish = 0.3;
              addDamageText(target.x, target.y, dmg, isCrit);
              addParticle(target.x * TILE_SIZE + TILE_SIZE / 2, target.y * TILE_SIZE + TILE_SIZE / 2, isCrit ? "#ff4444" : "#8B0000", isCrit ? 8 : 4);
              if (target.hp <= 0) {
                if (targetUnit) { targetUnit.alive = false; gameState.population -= targetUnit.pop; }
                if (targetBuilding) { targetBuilding.hp = 0; }
                addNotification(`${targetUnit ? UNITS[targetUnit.type.toUpperCase()].name : BUILDINGS[targetBuilding.type].name} destroyed`);
                Sound.playDeath();
              }
            }
            Sound.playAttack();
          }
        } else {
          u.x += dx / dist * u.speed * dt;
          u.y += dy / dist * u.speed * dt;
        }
      } else if (u.task === "attackMove") {
        const enemy = gameState.units.find(v => v.playerIndex !== u.playerIndex && v.alive && distance(u.x, u.y, v.x, v.y) <= u.range + 1);
        if (enemy) {
          unitAttack(u, "unit", enemy.id);
        } else if (u.movePath && u.movePathIndex < u.movePath.length) {
          const wp = u.movePath[u.movePathIndex];
          const dx = wp.x - u.x;
          const dy = wp.y - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.3) {
            u.movePathIndex++;
            if (u.movePathIndex >= u.movePath.length) {
              u.task = "idle";
              u.movePath = null;
              advanceCommand(u);
            }
          } else {
            u.x += dx / dist * u.speed * dt;
            u.y += dy / dist * u.speed * dt;
          }
        } else if (u.targetX !== undefined && u.targetY !== undefined) {
          const dx = u.targetX - u.x;
          const dy = u.targetY - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.3) {
            u.task = "idle";
            advanceCommand(u);
          } else {
            u.x += dx / dist * u.speed * dt;
            u.y += dy / dist * u.speed * dt;
          }
        } else {
          u.task = "idle";
          advanceCommand(u);
        }
      } else if (u.task === "move") {
        if (u.movePath && u.movePathIndex < u.movePath.length) {
          const wp = u.movePath[u.movePathIndex];
          const dx = wp.x - u.x;
          const dy = wp.y - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.3) {
            u.movePathIndex++;
            if (u.movePathIndex >= u.movePath.length) {
              u.task = "idle";
              u.movePath = null;
              advanceCommand(u);
            }
          } else {
            u.x += dx / dist * u.speed * dt;
            u.y += dy / dist * u.speed * dt;
          }
        } else if (u.targetX !== undefined && u.targetY !== undefined) {
          const dx = u.targetX - u.x;
          const dy = u.targetY - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.3) {
            u.task = "idle";
            advanceCommand(u);
          } else {
            u.x += dx / dist * u.speed * dt;
            u.y += dy / dist * u.speed * dt;
          }
        }
      } else if (u.task === "idle") {
        advanceCommand(u);
        if (u.task !== "idle") {
          continue;
        }
        if (u.type === "peasant") {
          u.task = "move";
          u.movePath = findPath(Math.floor(u.x), Math.floor(u.y), Math.floor(u.homeX), Math.floor(u.homeY));
          if (u.movePath) u.movePathIndex = 1;
        }
      }
    }
  }
  gameState.units = gameState.units.filter(u => u.alive);
}

function unitAttack(unit, targetType, targetId) {
  if (!unit || !unit.alive) return;
  unit.attackTarget = targetId;
  unit.attackType = targetType;
  unit.task = "attack";
  unit.attackTimer = 0;
}

function unitMove(unit, tx, ty) {
  if (!unit || !unit.alive) return;
  unit.targetX = tx;
  unit.targetY = ty;
  unit.task = "move";
  unit.movePath = findPath(Math.floor(unit.x), Math.floor(unit.y), Math.floor(tx), Math.floor(ty));
  if (unit.movePath) unit.movePathIndex = 1;
  else { unit.movePath = null; unit.movePathIndex = 0; }
}

function unitGather(unit, resType) {
  if (!unit || !unit.alive) return;
  unit.gatherType = resType;
  unit.task = "gather";
  unit.gatherTimer = 0;
  unit.gatherDone = false;
  const res = findNearestResource(unit.x, unit.y, resType);
  if (res) { unit.targetX = res.x; unit.targetY = res.y; }
}

function unitRepair(unit, buildingId) {
  if (!unit || !unit.alive || unit.type !== "peasant") return;
  unit.attackTarget = buildingId;
  unit.attackType = "building";
  unit.task = "repair";
  unit.gatherTimer = 0;
}

function unitStop(unit) {
  if (!unit || !unit.alive) return;
  unit.task = "idle";
  unit.targetX = unit.x;
  unit.targetY = unit.y;
  unit.attackTarget = null;
  unit.attackType = null;
  unit.gatherType = null;
  unit.gatherDone = false;
  unit.movePath = null;
  unit.movePathIndex = 0;
  unit.commandQueue = [];
}

function unitAttackMove(unit, tx, ty) {
  if (!unit || !unit.alive) return;
  unit.task = "attackMove";
  unit.targetX = tx;
  unit.targetY = ty;
  unit.movePath = findPath(Math.floor(unit.x), Math.floor(unit.y), Math.floor(tx), Math.floor(ty));
  if (unit.movePath) unit.movePathIndex = 1;
  else { unit.movePath = null; unit.movePathIndex = 0; }
}

// Combat formations - arrange selected units into tactical patterns
function setFormation(units, tx, ty, formation) {
  if (!units || units.length === 0) return;
  const leader = units[0];
  const angle = Math.atan2(ty - leader.y, tx - leader.x);
  const spacing = 0.8;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.alive) continue;
    let offset;
    const col = Math.floor(i / 3);
    const row = i % 3;
    switch (formation) {
      case "line":
        // Single line facing enemy
        offset = { x: Math.cos(angle + Math.PI/2) * (row - 1) * spacing, y: Math.sin(angle + Math.PI/2) * (row - 1) * spacing };
        break;
      case "wedge":
        // V-formation pointing at target
        offset = { x: Math.cos(angle) * col * spacing, y: Math.sin(angle) * col * spacing + (row - 1) * spacing };
        break;
      case "box":
        // Defensive square
        const side = Math.ceil(Math.sqrt(units.length));
        const cx = (i % side) - side/2;
        const cy = Math.floor(i / side) - side/2;
        offset = { x: cx * spacing, y: cy * spacing };
        break;
      case "scatter":
      default:
        offset = { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 };
    }
    const targetX = tx + offset.x;
    const targetY = ty + offset.y;
    unitMove(u, targetX, targetY);
    u.task = "attackMove";
  }
}

function setAggressiveFormation(units, tx, ty) {
  setFormation(units, tx, ty, "wedge");
}

function setDefensiveFormation(units, tx, ty) {
  setFormation(units, tx, ty, "box");
}

function advanceCommand(u) {
  if (!u.commandQueue.length) return;
  const cmd = u.commandQueue.shift();
  if (cmd.type === "move") unitMove(u, cmd.tx, cmd.ty);
  else if (cmd.type === "attack") unitAttack(u, cmd.targetType, cmd.targetId);
  else if (cmd.type === "attackMove") unitAttackMove(u, cmd.tx, cmd.ty);
  else if (cmd.type === "gather") unitGather(u, cmd.resType);
  else if (cmd.type === "repair") unitRepair(u, cmd.buildingId);
  else if (cmd.type === "stop") unitStop(u);
}

// Enhanced health bar with gradient and outline
function drawUnitHealthBar(ctx, u, cx, y, ts) {
  if (u.hp >= u.maxHp) return;
  const barW = ts * 0.58;
  const barH = Math.max(3, ts * 0.07);
  const hpRatio = u.hp / u.maxHp;
  const hpColor = hpRatio > 0.5 ? "#64b852" : hpRatio > 0.25 ? "#e1a93d" : "#bf3e34";
  
  // Dark background with rounded corners
  ctx.fillStyle = "rgba(20, 18, 12, 0.8)";
  ctx.beginPath();
  const r = 2;
  const bx = cx - barW / 2;
  ctx.moveTo(bx + r, y);
  ctx.lineTo(bx + barW - r, y);
  ctx.quadraticCurveTo(bx + barW, y, bx + barW, y + r);
  ctx.lineTo(bx + barW, y + barH - r);
  ctx.quadraticCurveTo(bx + barW, y + barH, bx + barW - r, y + barH);
  ctx.lineTo(bx + r, y + barH);
  ctx.quadraticCurveTo(bx, y + barH, bx, y + barH - r);
  ctx.lineTo(bx, y + r);
  ctx.quadraticCurveTo(bx, y, bx + r, y);
  ctx.closePath();
  ctx.fill();
  
  // Health fill with gradient
  const gradient = ctx.createLinearGradient(cx - barW / 2, y, cx + barW / 2, y);
  gradient.addColorStop(0, hpColor);
  gradient.addColorStop(1, hpColor + "cc");
  ctx.fillStyle = gradient;
  ctx.fillRect(cx - barW / 2 + 1, y + 1, Math.max(0, (barW - 2) * hpRatio), Math.max(1, barH - 2));
}

// Enhanced unit drawing with animation
function drawUnitSilhouette(ctx, u, cx, cy, ts) {
  const scale = ts / 40;
  const teamColor = PLAYER_COLORS[u.playerIndex] || "#4caf50";
  const skin = "#d49a6a";
  const darkSkin = "#a86f4c";
  const robe = u.type === "peasant" ? "#8e7355" : u.type === "archer" ? "#557a3c" : "#7d3f36";
  const metal = "#c8c5b8";
  
  // Walking animation offset (bob up and down)
  const walkCycle = Math.sin(u.animFrame * Math.PI) * (u.task === "move" || u.task === "gather" ? 2 : 0);
  
  ctx.save();
  ctx.translate(cx, cy + walkCycle); // Apply bob
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  
  // Attack squish effect
  const squishX = 1 + u.squish * 0.3;
  const squishY = 1 - u.squish * 0.3;
  ctx.scale(squishX, squishY);
  
  // Shadow with soft edge
  ctx.fillStyle = "rgba(23, 30, 18, 0.32)";
  ctx.beginPath();
  ctx.ellipse(0, ts * 0.22 + walkCycle * 0.5, ts * 0.25, ts * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  
  if (u.type === "cavalry") {
    ctx.fillStyle = "#805039";
    ctx.beginPath();
    ctx.ellipse(-ts * 0.04, ts * 0.07 + walkCycle * 0.5, ts * 0.27, ts * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6a3c2b";
    ctx.fillRect(ts * 0.17, -ts * 0.05 + walkCycle, ts * 0.12, ts * 0.2);
    ctx.fillStyle = "#35251f";
    ctx.fillRect(-ts * 0.18, ts * 0.17 + walkCycle, ts * 0.06, ts * 0.14);
    ctx.fillRect(ts * 0.1, ts * 0.17 + walkCycle, ts * 0.06, ts * 0.14);
    ctx.fillStyle = "#b89152";
    ctx.fillRect(-ts * 0.19, -ts * 0.02 + walkCycle, ts * 0.28, ts * 0.08);
  }
  
  const riderOffset = u.type === "cavalry" ? -ts * 0.12 : 0;
  ctx.fillStyle = "#30383d";
  ctx.fillRect(-ts * 0.11, riderOffset + ts * 0.08 + walkCycle, ts * 0.08, ts * 0.18);
  ctx.fillRect(ts * 0.03, riderOffset + ts * 0.08 + walkCycle, ts * 0.08, ts * 0.18);
  
  ctx.fillStyle = u.type === "samurai" ? "#38454d" : robe;
  ctx.beginPath();
  ctx.moveTo(-ts * 0.16, riderOffset - ts * 0.05 + walkCycle);
  ctx.lineTo(ts * 0.16, riderOffset - ts * 0.05 + walkCycle);
  ctx.lineTo(ts * 0.12, riderOffset + ts * 0.16 + walkCycle);
  ctx.lineTo(-ts * 0.12, riderOffset + ts * 0.16 + walkCycle);
  ctx.closePath();
  ctx.fill();
  
  ctx.fillStyle = teamColor;
  ctx.fillRect(-ts * 0.16, riderOffset + ts * 0.02 + walkCycle, ts * 0.32, ts * 0.055);
  ctx.fillStyle = darkSkin;
  ctx.beginPath();
  ctx.arc(0, riderOffset - ts * 0.13 + walkCycle, ts * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(-ts * 0.015, riderOffset - ts * 0.145 + walkCycle, ts * 0.082, 0, Math.PI * 2);
  ctx.fill();
  
  if (u.type === "peasant") {
    // Enhanced farmer with tool animation
    const toolSwing = Math.sin(u.animFrame * 0.5) * 0.2 * (u.task === "gather" ? 1 : 0);
    ctx.fillStyle = "#c8a55a";
    ctx.beginPath();
    ctx.ellipse(0, riderOffset - ts * 0.205 + walkCycle, ts * 0.13, ts * 0.042, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#744826";
    ctx.lineWidth = Math.max(2, 2.5 * scale);
    ctx.beginPath();
    ctx.moveTo(ts * 0.12, riderOffset + ts * 0.01 + walkCycle);
    ctx.lineTo(ts * 0.27 + toolSwing * ts, riderOffset - ts * 0.2 + walkCycle);
    ctx.stroke();
    ctx.strokeStyle = "#a2a7a1";
    ctx.beginPath();
    ctx.moveTo(ts * 0.22, riderOffset - ts * 0.22 + walkCycle);
    ctx.lineTo(ts * 0.31, riderOffset - ts * 0.16 + walkCycle);
    ctx.stroke();
  } else if (u.type === "archer") {
    // Enhanced archer with bow animation
    const bowAnimate = Math.sin(u.animFrame * 0.7) * 0.1 * (u.task === "attack" ? 1 : 0);
    ctx.strokeStyle = "#8a5b32";
    ctx.lineWidth = Math.max(2, 2.4 * scale);
    ctx.beginPath();
    ctx.arc(ts * 0.2 + bowAnimate * ts, riderOffset, ts * 0.16, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = "#e6d4a9";
    ctx.lineWidth = Math.max(1, scale);
    ctx.beginPath();
    ctx.moveTo(ts * 0.2 + bowAnimate * ts, riderOffset - ts * 0.16);
    ctx.lineTo(ts * 0.2 + bowAnimate * ts, riderOffset + ts * 0.16);
    ctx.stroke();
  } else if (u.type === "samurai") {
    // Enhanced samurai with attack animation
    const swordSwing = Math.sin(u.animFrame * 1.2) * 0.4 * (u.task === "attack" ? 1 : 0);
    ctx.fillStyle = "#252b30";
    ctx.beginPath();
    ctx.arc(0, riderOffset - ts * 0.2 + walkCycle, ts * 0.115, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#d1b05f";
    ctx.fillRect(-ts * 0.13, riderOffset - ts * 0.165 + walkCycle, ts * 0.26, ts * 0.035);
    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(2, 2.5 * scale);
    ctx.beginPath();
    ctx.moveTo(ts * 0.1, riderOffset + ts * 0.08 + walkCycle);
    ctx.lineTo(ts * 0.28 + swordSwing * ts, riderOffset - ts * 0.16 + walkCycle);
    ctx.stroke();
  } else {
    // Enhanced warrior with weapon animation
    ctx.fillStyle = "#69747a";
    ctx.beginPath();
    ctx.moveTo(-ts * 0.1, riderOffset - ts * 0.19 + walkCycle);
    ctx.lineTo(ts * 0.1, riderOffset - ts * 0.19 + walkCycle);
    ctx.lineTo(ts * 0.06, riderOffset - ts * 0.28 + walkCycle);
    ctx.lineTo(-ts * 0.06, riderOffset - ts * 0.28 + walkCycle);
    ctx.closePath();
    ctx.fill();
    const weaponSwing = Math.sin(u.animFrame * 1.2) * 0.3 * (u.task === "attack" ? 1 : 0);
    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(2, 2.5 * scale);
    ctx.beginPath();
    ctx.moveTo(ts * 0.1, riderOffset + ts * 0.08 + walkCycle);
    ctx.lineTo(ts * 0.27 + weaponSwing * ts, riderOffset - ts * 0.18 + walkCycle);
    ctx.stroke();
  }
  ctx.restore();
}

// Floating damage text update
function updateFloatTexts(dt) {
  if (!gameState.floatTexts) return;
  gameState.floatTexts = gameState.floatTexts.filter(t => {
    t.life -= dt * 2;
    t.y += t.vy * dt;
    return t.life > 0;
  });
}

// Enhanced renderUnits with selection glow, animations, floating text, and projectiles
function renderUnits(ctx) {
  for (const u of gameState.units) {
    if (!u.alive) continue;
    const pos = getWorldToScreen(u.x, u.y);
    const ts = TILE_SIZE * gameState.camera.zoom;
    const isSelected = gameState.selectedUnits.some(v => v.id === u.id);
    const cx = pos.x + ts / 2;
    const cy = pos.y + ts * 0.54;

    drawUnitSilhouette(ctx, u, cx, cy, ts);
    drawUnitHealthBar(ctx, u, cx, pos.y - ts * 0.08, ts);

    // Veteran level indicator
    if (u.veteran > 0) {
      ctx.fillStyle = "#ffd700";
      ctx.font = `bold ${Math.max(8, ts * 0.2)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("★".repeat(u.veteran), pos.x + ts * 0.05, pos.y);
    }

    // Archer range indicator when selected
    if (isSelected && u.type === "archer") {
      ctx.strokeStyle = "rgba(255,140,0,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, u.range * ts, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Enhanced selection indicator with pulsing glow
    if (isSelected) {
      const pulse = 0.7 + Math.sin(u.animFrame) * 0.3;

      // Outer glow
      ctx.strokeStyle = `rgba(245, 214, 106, ${pulse * 0.3})`;
      ctx.lineWidth = Math.max(4, ts * 0.08);
      ctx.beginPath();
      ctx.ellipse(cx, pos.y + ts * 0.72, ts * 0.31, ts * 0.14, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Inner glow
      ctx.strokeStyle = `rgba(245, 214, 106, ${pulse * 0.6})`;
      ctx.lineWidth = Math.max(2, ts * 0.05);
      ctx.beginPath();
      ctx.ellipse(cx, pos.y + ts * 0.72, ts * 0.31, ts * 0.14, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Core selection line
      ctx.strokeStyle = "rgba(245, 214, 106, 0.9)";
      ctx.lineWidth = Math.max(1, ts * 0.025);
      ctx.beginPath();
      ctx.ellipse(cx, pos.y + ts * 0.72, ts * 0.31, ts * 0.14, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Floating damage text
  if (gameState.floatTexts) {
    for (const t of gameState.floatTexts) {
      const pos = getWorldToScreen(t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.globalAlpha = Math.max(0, t.life);
      ctx.font = `bold ${Math.max(10, 40 * 0.25)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t.text, pos.x, pos.y);
      ctx.globalAlpha = 1;
    }
  }
}

window.createUnit = createUnit;
window.updateUnits = updateUnits;
window.renderUnits = renderUnits;
window.unitAttack = unitAttack;
window.unitMove = unitMove;
window.unitGather = unitGather;
window.unitRepair = unitRepair;
window.unitStop = unitStop;
window.unitAttackMove = unitAttackMove;
window.advanceCommand = advanceCommand;
window.upgradeUnit = upgradeUnit;
window.getUpgradeCost = getUpgradeCost;
window.garrisonUnit = garrisonUnit;
window.ungarrison = ungarrison;
window.addDamageText = addDamageText;
window.updateFloatTexts = updateFloatTexts;
window.addProjectile = addProjectile;
window.updateProjectiles = updateProjectiles;
window.renderProjectiles = renderProjectiles;
window.setFormation = setFormation;
window.setAggressiveFormation = setAggressiveFormation;
window.setDefensiveFormation = setDefensiveFormation;