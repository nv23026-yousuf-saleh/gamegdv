// Brick Breaker Pro - Enhanced Edition
// 15 Levels with progressive difficulty, powerups, combos, and visual effects

const canvas = document.getElementById("gameCanvas")
const ctx = canvas.getContext("2d")
const particlesContainer = document.getElementById("particles")

const W = canvas.width
const H = canvas.height

// DOM elements
const scoreEl = document.getElementById("scoreValue")
const levelEl = document.getElementById("levelValue")
const livesEl = document.getElementById("livesValue")
const pauseBtn = document.getElementById("pauseBtn")
const restartBtn = document.getElementById("restartBtn")

// Audio context for sound effects
const audioCtx = new (window.AudioContext || window.webkitAudioContext)()

function playSound(freq = 440, duration = 0.05, type = "sine", volume = 0.05) {
  const oscillator = audioCtx.createOscillator()
  const gainNode = audioCtx.createGain()

  oscillator.type = type
  oscillator.frequency.value = freq
  gainNode.gain.value = volume

  oscillator.connect(gainNode)
  gainNode.connect(audioCtx.destination)

  oscillator.start()
  oscillator.stop(audioCtx.currentTime + duration)
}

// Utility functions
const rand = (min, max) => min + Math.random() * (max - min)
const clamp = (val, min, max) => Math.max(min, Math.min(max, val))

// Game state
let score = 0
let lives = 3
let level = 0
const TOTAL_LEVELS = 15
let paused = false
let gameOver = false
let awaitingLaunch = true
let combo = 0
let comboTimer = 0
let screenShake = 0

// Paddle
const paddle = {
  x: W / 2 - 80,
  y: H - 50,
  w: 160,
  h: 16,
  speed: 900,
  originalW: 160,
}

// Balls
let balls = []

// Bricks
let bricks = []

// Powerups
const powerups = []
const POWERUP_TYPES = [
  { id: "multi", icon: "⚪", color: "#4ade80" },
  { id: "expand", icon: "⇔", color: "#fbbf24" },
  { id: "slow", icon: "⏱", color: "#8b5cf6" },
  { id: "life", icon: "♥", color: "#f43f5e" },
  { id: "full", icon: "━", color: "#06b6d4" },
  { id: "2x", icon: "2×", color: "#fb923c" },
]

// Powerup state
const powerupState = {
  fullTimer: 0,
  scoreMultiplier: 1,
  multiplierTimer: 0,
}

// Particles
const particles = []

// Input handling
const keys = {}
let mouseX = paddle.x + paddle.w / 2

window.addEventListener("keydown", (e) => {
  keys[e.key] = true

  if (e.key === " " && awaitingLaunch) {
    launchBall()
  }
  if (e.key === "p" || e.key === "P") {
    togglePause()
  }
  if (e.key === "Enter") {
    restartGame()
  }
})

window.addEventListener("keyup", (e) => {
  keys[e.key] = false
})

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect()
  mouseX = (e.clientX - rect.left) * (W / rect.width)
})

canvas.addEventListener("click", () => {
  if (awaitingLaunch) {
    launchBall()
  }
})

canvas.addEventListener("touchstart", (e) => {
  const touch = e.touches[0]
  const rect = canvas.getBoundingClientRect()
  mouseX = (touch.clientX - rect.left) * (W / rect.width)

  if (awaitingLaunch) {
    launchBall()
  }
})

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault()
  const touch = e.touches[0]
  const rect = canvas.getBoundingClientRect()
  mouseX = (touch.clientX - rect.left) * (W / rect.width)
})

pauseBtn.addEventListener("click", togglePause)
restartBtn.addEventListener("click", restartGame)

// Ball management
function spawnBall() {
  balls.push({
    x: paddle.x + paddle.w / 2,
    y: paddle.y - 14,
    r: 10,
    vx: 0,
    vy: 0,
    speed: 480,
    sticky: true,
    slowTimer: 0,
  })
  awaitingLaunch = true
}

function launchBall() {
  awaitingLaunch = false
  balls.forEach((ball) => {
    if (ball.sticky) {
      ball.sticky = false
      const angle = rand(-Math.PI * 0.7, -Math.PI * 0.3)
      ball.vx = Math.cos(angle) * ball.speed
      ball.vy = Math.sin(angle) * ball.speed
    }
  })
  playSound(880, 0.05, "sine", 0.06)
}

// Level generation
function generateLevel(levelIndex) {
  const lvl = levelIndex + 1
  const rows = clamp(4 + Math.floor(lvl / 1.5), 5, 12)
  const cols = 12
  const padding = 6
  const marginX = 32
  const marginY = 80
  const brickW = (W - 2 * marginX - (cols - 1) * padding) / cols
  const brickH = 24

  const newBricks = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Create interesting patterns
      let shouldPlace = true

      if (lvl >= 5 && (row + col) % 8 === 0) shouldPlace = false
      if (lvl >= 8 && col % 2 === 0 && row % 3 === 0) shouldPlace = false
      if (lvl >= 12 && Math.random() < 0.1) shouldPlace = false

      if (!shouldPlace) continue

      const x = marginX + col * (brickW + padding)
      const y = marginY + row * (brickH + padding)

      // Determine brick properties
      let hp = 1 + Math.floor(lvl / 4) + Math.floor(row / 5)
      let indestructible = false

      if (lvl >= 10 && Math.random() < 0.04) {
        indestructible = true
        hp = Number.POSITIVE_INFINITY
      }

      // Moving bricks
      let moving = false
      let moveRange = 0
      let moveSpeed = 0

      if (lvl >= 6 && Math.random() < 0.07) {
        moving = true
        moveRange = rand(50, 120)
        moveSpeed = rand(40, 80)
      }

      const points = indestructible ? 0 : Math.round(50 * hp * (1 + lvl / 8))

      newBricks.push({
        x,
        y,
        w: brickW,
        h: brickH,
        hp,
        maxHp: hp,
        points,
        indestructible,
        moving,
        baseX: x,
        moveRange,
        moveSpeed,
        direction: Math.random() < 0.5 ? 1 : -1,
        destroyed: false,
      })
    }
  }

  return newBricks
}

function loadLevel(levelIndex) {
  level = levelIndex
  bricks = generateLevel(levelIndex)
  balls = []
  spawnBall()
  combo = 0
  updateUI()
}

// Powerup management
function spawnPowerup(x, y) {
  if (Math.random() > 0.22) return

  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]

  powerups.push({
    x,
    y,
    vx: rand(-50, 50),
    vy: 140,
    type,
    w: 32,
    h: 32,
    life: 8,
  })
}

function applyPowerup(powerup) {
  switch (powerup.type.id) {
    case "multi":
      if (balls.length > 0) {
        const base = balls[0]
        for (let i = 0; i < 2; i++) {
          balls.push({
            x: base.x,
            y: base.y,
            r: 10,
            vx: rand(-1, 1) * base.speed,
            vy: -Math.abs(rand(0.7, 1)) * base.speed,
            speed: base.speed,
            sticky: false,
            slowTimer: 0,
          })
        }
      }
      break

    case "expand":
      paddle.w = Math.min(W - 40, paddle.w + 70)
      break

    case "slow":
      balls.forEach((ball) => {
        ball.slowTimer = Math.max(ball.slowTimer, 8)
      })
      break

    case "life":
      lives = Math.min(9, lives + 1)
      break

    case "full":
      paddle.w = W - 40
      powerupState.fullTimer = 8
      break

    case "2x":
      powerupState.scoreMultiplier = 2
      powerupState.multiplierTimer = 10
      break
  }

  playSound(1400, 0.08, "triangle", 0.08)
  createParticles(powerup.x, powerup.y, powerup.type.color, 12)
}

// Collision detection
function circleRectCollision(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w)
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h)
  const dx = circle.x - closestX
  const dy = circle.y - closestY
  return dx * dx + dy * dy <= circle.r * circle.r
}

// Particle effects
function createParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count
    const speed = rand(100, 200)
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5,
      maxLife: 0.5,
      size: rand(3, 7),
      color,
    })
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.life -= dt

    if (p.life <= 0) {
      particles.splice(i, 1)
    }
  }
}

function drawParticles() {
  particles.forEach((p) => {
    const alpha = p.life / p.maxLife
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.globalAlpha = 1
}

// Combo system
function showCombo(x, y, comboCount) {
  const popup = document.createElement("div")
  popup.className = "combo-popup"
  popup.textContent = `COMBO ×${comboCount}`
  popup.style.left = `${x}px`
  popup.style.top = `${y}px`
  particlesContainer.appendChild(popup)

  setTimeout(() => popup.remove(), 1000)
}

// Update game logic
function update(dt) {
  // Update powerup timers
  if (powerupState.fullTimer > 0) {
    powerupState.fullTimer -= dt
    if (powerupState.fullTimer <= 0) {
      paddle.w = paddle.originalW
    }
  }

  if (powerupState.multiplierTimer > 0) {
    powerupState.multiplierTimer -= dt
    if (powerupState.multiplierTimer <= 0) {
      powerupState.scoreMultiplier = 1
    }
  }

  // Update combo timer
  if (comboTimer > 0) {
    comboTimer -= dt
    if (comboTimer <= 0) {
      combo = 0
    }
  }

  // Screen shake
  if (screenShake > 0) {
    screenShake = Math.max(0, screenShake - dt * 8)
  }

  // Move paddle
  const targetX = mouseX - paddle.w / 2
  if (Math.abs(mouseX - (paddle.x + paddle.w / 2)) > 2) {
    paddle.x += (targetX - paddle.x) * clamp(15 * dt, 0, 1)
  }

  if (keys["ArrowLeft"] || keys["a"]) {
    paddle.x -= paddle.speed * dt
  }
  if (keys["ArrowRight"] || keys["d"]) {
    paddle.x += paddle.speed * dt
  }

  paddle.x = clamp(paddle.x, 10, W - paddle.w - 10)

  // Update balls
  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i]

    if (ball.sticky) {
      ball.x = paddle.x + paddle.w / 2
      ball.y = paddle.y - ball.r - 2
      continue
    }

    let speedMult = 1
    if (ball.slowTimer > 0) {
      speedMult = 0.6
      ball.slowTimer -= dt
    }

    ball.x += ball.vx * dt * speedMult
    ball.y += ball.vy * dt * speedMult

    // Wall collisions
    if (ball.x - ball.r <= 8) {
      ball.x = 8 + ball.r
      ball.vx = Math.abs(ball.vx)
      playSound(1100, 0.02, "sine", 0.03)
    }
    if (ball.x + ball.r >= W - 8) {
      ball.x = W - 8 - ball.r
      ball.vx = -Math.abs(ball.vx)
      playSound(1100, 0.02, "sine", 0.03)
    }
    if (ball.y - ball.r <= 8) {
      ball.y = 8 + ball.r
      ball.vy = Math.abs(ball.vy)
      playSound(1100, 0.02, "sine", 0.03)
    }

    // Ball falls off screen
    if (ball.y - ball.r > H + 50) {
      balls.splice(i, 1)
      continue
    }

    // Paddle collision
    if (circleRectCollision(ball, paddle) && ball.vy > 0) {
      const hitX = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2)
      const angle = clamp(hitX, -0.95, 0.95) * Math.PI * 0.4
      ball.vx = Math.sin(angle) * ball.speed
      ball.vy = -Math.cos(angle) * ball.speed
      ball.y = paddle.y - ball.r - 2
      playSound(800, 0.03, "square", 0.05)
    }

    // Brick collision
    for (const brick of bricks) {
      if (brick.destroyed || brick.indestructible) continue

      if (circleRectCollision(ball, brick)) {
        // Simple bounce
        const prevX = ball.x - ball.vx * dt
        const prevY = ball.y - ball.vy * dt

        if (prevY + ball.r <= brick.y || prevY - ball.r >= brick.y + brick.h) {
          ball.vy *= -1
        } else {
          ball.vx *= -1
        }

        brick.hp--

        if (brick.hp <= 0) {
          brick.destroyed = true
          const points = brick.points * powerupState.scoreMultiplier
          score += points

          // Combo system
          combo++
          comboTimer = 1.5

          if (combo >= 5 && combo % 5 === 0) {
            const bonusPoints = combo * 50
            score += bonusPoints
            const rect = canvas.getBoundingClientRect()
            showCombo(brick.x - rect.left + brick.w / 2, brick.y - rect.top)
            screenShake = 0.3
          }

          spawnPowerup(brick.x + brick.w / 2, brick.y + brick.h / 2)
          createParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, getBrickColor(brick), 10)
          playSound(1300 + combo * 50, 0.04, "sawtooth", 0.06)
        } else {
          score += Math.round(10 * powerupState.scoreMultiplier)
          playSound(950, 0.02, "square", 0.04)
        }

        break
      }
    }
  }

  // Update moving bricks
  const time = performance.now() / 1000
  bricks.forEach((brick) => {
    if (brick.moving && !brick.destroyed) {
      brick.x = brick.baseX + Math.sin((time * brick.moveSpeed) / 30) * brick.moveRange
    }
  })

  // Update powerups
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.life -= dt

    if (p.life <= 0 || p.y > H + 50) {
      powerups.splice(i, 1)
      continue
    }

    // Catch powerup
    if (
      p.x >= paddle.x &&
      p.x <= paddle.x + paddle.w &&
      p.y + p.h / 2 >= paddle.y &&
      p.y - p.h / 2 <= paddle.y + paddle.h
    ) {
      applyPowerup(p)
      powerups.splice(i, 1)
    }
  }

  // Check for lost ball
  if (balls.length === 0 && !awaitingLaunch) {
    lives--
    combo = 0

    if (lives <= 0) {
      gameOver = true
      paused = true
      playSound(200, 0.6, "sine", 0.12)
    } else {
      spawnBall()
      playSound(400, 0.1, "sine", 0.08)
    }
  }

  // Check level complete
  const anyBricksLeft = bricks.some((b) => !b.destroyed && !b.indestructible)
  if (!anyBricksLeft) {
    score += 500 + level * 100
    playSound(1800, 0.2, "triangle", 0.1)

    if (level < TOTAL_LEVELS - 1) {
      loadLevel(level + 1)
    } else {
      // Game won!
      gameOver = true
      paused = true
    }
  }

  updateParticles(dt)
  updateUI()
}

// Rendering
function render() {
  // Clear canvas
  ctx.clearRect(0, 0, W, H)

  // Apply screen shake
  if (screenShake > 0) {
    ctx.save()
    ctx.translate(rand(-screenShake * 10, screenShake * 10), rand(-screenShake * 10, screenShake * 10))
  }

  // Draw bricks
  bricks.forEach((brick) => {
    if (brick.destroyed) return

    ctx.fillStyle = getBrickColor(brick)
    ctx.shadowBlur = 8
    ctx.shadowColor = getBrickColor(brick)
    roundRect(ctx, brick.x, brick.y, brick.w, brick.h, 6)
    ctx.fill()
    ctx.shadowBlur = 0

    // Health indicator for multi-hit bricks
    if (!brick.indestructible && brick.maxHp > 1) {
      const healthRatio = brick.hp / brick.maxHp
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)"
      ctx.fillRect(brick.x + 4, brick.y + brick.h - 6, (brick.w - 8) * healthRatio, 2)
    }
  })

  // Draw powerups
  powerups.forEach((p) => {
    ctx.fillStyle = p.type.color
    ctx.shadowBlur = 10
    ctx.shadowColor = p.type.color
    roundRect(ctx, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 8)
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.fillStyle = "#000"
    ctx.font = "bold 16px Arial"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(p.type.icon, p.x, p.y)
  })

  // Draw paddle
  const gradient = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.h)
  gradient.addColorStop(0, "#5eb3ff")
  gradient.addColorStop(1, "#3a8fd9")
  ctx.fillStyle = gradient
  ctx.shadowBlur = 12
  ctx.shadowColor = "rgba(94, 179, 255, 0.6)"
  roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 8)
  ctx.fill()
  ctx.shadowBlur = 0

  // Draw balls
  balls.forEach((ball) => {
    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)"
    ctx.beginPath()
    ctx.ellipse(ball.x + 3, ball.y + 8, ball.r * 1.1, ball.r * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // Ball
    const ballGradient = ctx.createRadialGradient(
      ball.x - ball.r / 3,
      ball.y - ball.r / 3,
      ball.r / 8,
      ball.x,
      ball.y,
      ball.r,
    )
    ballGradient.addColorStop(0, "#ff8e9b")
    ballGradient.addColorStop(1, "#ff5e6c")
    ctx.fillStyle = ballGradient
    ctx.shadowBlur = 10
    ctx.shadowColor = "rgba(255, 94, 108, 0.6)"
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  })

  // Draw particles
  drawParticles()

  // Restore screen shake
  if (screenShake > 0) {
    ctx.restore()
  }

  // Draw UI overlay
  if (awaitingLaunch && balls.length > 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
    ctx.font = "bold 18px Arial"
    ctx.textAlign = "center"
    ctx.fillText("CLICK OR PRESS SPACE TO LAUNCH", W / 2, H / 2)
  }

  if (paused) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
    ctx.fillRect(0, 0, W, H)

    ctx.fillStyle = "#fff"
    ctx.font = "bold 48px Arial"
    ctx.textAlign = "center"
    ctx.fillText(gameOver ? "GAME OVER" : "PAUSED", W / 2, H / 2 - 20)

    ctx.font = "20px Arial"
    if (gameOver) {
      ctx.fillText(`Final Score: ${score}`, W / 2, H / 2 + 30)
      ctx.font = "16px Arial"
      ctx.fillText("Press Restart to play again", W / 2, H / 2 + 60)
    }
  }

  // Combo indicator
  if (combo >= 3) {
    ctx.fillStyle = "rgba(251, 191, 36, 0.9)"
    ctx.font = "bold 20px Arial"
    ctx.textAlign = "right"
    ctx.fillText(`COMBO ×${combo}`, W - 20, 40)
  }
}

// Helper functions
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function getBrickColor(brick) {
  if (brick.indestructible) {
    return "#444"
  }

  const hpRatio = clamp(brick.hp / brick.maxHp, 0, 1)
  const hue = 220 + (360 - 220) * (1 - hpRatio)
  const saturation = 70 + 30 * hpRatio
  const lightness = 50 + 15 * hpRatio

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

function updateUI() {
  scoreEl.textContent = score.toLocaleString()
  levelEl.textContent = `${level + 1}/${TOTAL_LEVELS}`
  livesEl.textContent = "♥".repeat(Math.max(0, lives))
  pauseBtn.textContent = paused ? "Resume" : "Pause"
}

function togglePause() {
  if (gameOver) return
  paused = !paused
  if (!paused && audioCtx.state === "suspended") {
    audioCtx.resume()
  }
  updateUI()
}

function restartGame() {
  score = 0
  lives = 3
  level = 0
  paused = false
  gameOver = false
  combo = 0
  paddle.w = paddle.originalW
  powerupState.fullTimer = 0
  powerupState.scoreMultiplier = 1
  powerupState.multiplierTimer = 0
  particles.length = 0
  powerups.length = 0
  loadLevel(0)
  playSound(660, 0.08, "square", 0.08)
}

// Game loop
let lastTime = performance.now()

function gameLoop(currentTime) {
  const dt = Math.min(0.033, (currentTime - lastTime) / 1000)
  lastTime = currentTime

  if (!paused) {
    update(dt)
  }

  render()
  requestAnimationFrame(gameLoop)
}

// Initialize game
loadLevel(0)
updateUI()
requestAnimationFrame(gameLoop)
