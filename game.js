const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameScale = 1;
let virtualWidth = 800;
let virtualHeight = 400;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Default virtual size is 800x400
    // We want to scale so that the 800x400 area fits within the window
    const scaleX = window.innerWidth / 800;
    const scaleY = window.innerHeight / 400;

    // Use the smaller scale to ensure everything fits on screen (contain)
    // or use X scale and let height be dynamic for side-scrollers
    gameScale = Math.min(scaleX, scaleY);

    // If the screen is very wide or tall, we might want to cap the scale
    // but for mobile, we usually just want it to fill as much as possible.

    virtualWidth = canvas.width / gameScale;
    virtualHeight = canvas.height / gameScale;

    try {
        if (player) {
            if (gameState === 'START' || !player.isJumping) {
                player.y = virtualHeight - 20 - player.height;
            }
        }
    } catch (e) { }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const scoreDisplay = document.getElementById('score');
const finalScoreDisplay = document.getElementById('final-score');
const highScoreDisplay = document.getElementById('highscore');
const finalHighScoreDisplay = document.getElementById('final-highscore');
const gameContainer = document.getElementById('game-container');

// Images
const playerImg = document.getElementById('player-img');
const obstacleImg = document.getElementById('obstacle-img');
const gemImg = document.getElementById('gem-img');

// Use the original sprite sheet and trust the Service Worker for cache management
playerImg.src = 'assets/player_spritesheet.png';
obstacleImg.src = 'assets/obstacle.webp';
gemImg.src = 'assets/gem.webp';

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let highScore = localStorage.getItem('polynesianRunnerHighScore') || 0;
let gemsCollected = 0;
let animationId;
let frameCount = 0;
let baseSpeed = 5;

// Physics Consts
const GRAVITY = 0.6;
const JUMP_FORCE = -12;

// Entities
const player = {
    x: 50,
    y: 200,
    width: 90,
    height: 120,
    vy: 0,
    isJumping: false,
    isDucking: false,
    jumpCount: 0,

    // Animation properties
    frameX: 0,
    frameY: 0,
    frameTimer: 0,
    fps: 15,

    draw() {
        // Handle ducking state rendering
        let renderWidth = this.width;
        let renderHeight = this.isDucking ? this.height / 2 : this.height;
        let renderY = this.isDucking ? this.y + this.height / 2 : this.y;

        ctx.save();

        // Sprite Dimensions for the 3x2 sheet mapped dynamically
        let sWidth = playerImg.naturalWidth / 3;
        let sHeight = playerImg.naturalHeight / 2;

        // Update frames if playing and not jumping
        if (gameState === 'PLAYING' && !this.isJumping && !this.isDucking) {
            this.frameTimer++;
            if (this.frameTimer >= 60 / this.fps) {
                this.frameTimer = 0;
                let currentTotalFrame = this.frameY * 3 + this.frameX;
                currentTotalFrame = (currentTotalFrame + 1) % 6;
                this.frameX = currentTotalFrame % 3;
                this.frameY = Math.floor(currentTotalFrame / 3);
            }
        } else if (this.isJumping) {
            this.frameX = 1; // Jumping frame
            this.frameY = 0;
        } else if (this.isDucking) {
            this.frameX = 2; // Ducking frame
            this.frameY = 1;
        } else {
            this.frameX = 0; // Idle frame
            this.frameY = 0;
        }

        let sX = this.frameX * sWidth;
        let sY = this.frameY * sHeight;

        if (playerImg.complete && playerImg.naturalWidth !== 0) {
            ctx.drawImage(playerImg, sX, sY, sWidth, sHeight, this.x, renderY, renderWidth, renderHeight);
        } else {
            // Fallback drawing if image fails to load
            ctx.fillStyle = this.isDucking ? 'blue' : 'red';
            ctx.fillRect(this.x, renderY, renderWidth, renderHeight);
        }

        ctx.restore();
    },

    update() {
        this.vy += GRAVITY;
        this.y += this.vy;

        // Ground collision (ground is at canvas.height - 20)
        if (this.y >= virtualHeight - 20 - this.height && this.vy >= 0) {
            this.vy = 0;
            this.y = virtualHeight - 20 - this.height;
            this.isJumping = false;
            this.jumpCount = 0;
        } else {
            this.isJumping = true;
        }
    },

    jump() {
        if (!this.isDucking && this.jumpCount < 2) {
            this.vy = JUMP_FORCE;
            this.isJumping = true;
            this.jumpCount++;
        }
    },

    duck(state) {
        if (!this.isJumping) {
            this.isDucking = state;
        }
    }
};

let obstacles = [];
let gems = [];

class Obstacle {
    constructor() {
        this.width = 40 + Math.random() * 30; // 40-70 Width
        this.height = 50 + Math.random() * 50; // 50-100 Height
        this.x = virtualWidth;
        this.y = virtualHeight - 20 - this.height;
        this.speed = baseSpeed + Math.random() * 2;
    }

    draw() {
        if (obstacleImg.complete && obstacleImg.naturalWidth !== 0) {
            ctx.drawImage(obstacleImg, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = 'brown';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    update() {
        this.x -= this.speed;
        this.draw();
    }
}

class Gem {
    constructor() {
        this.width = 30;
        this.height = 30;
        this.x = virtualWidth;

        // Appear at varying heights (ground, mid-air, high-air)
        this.y = virtualHeight - 50 - Math.random() * 150;
        this.speed = baseSpeed;
    }

    draw() {
        if (gemImg.complete && gemImg.naturalWidth !== 0) {
            ctx.drawImage(gemImg, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = 'gold';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    update() {
        this.x -= this.speed;
        this.draw();
    }
}

// Controls
document.addEventListener('keydown', (e) => {
    // Handle starting the game via Spacebar
    if (gameState === 'START' || gameState === 'GAMEOVER') {
        if (e.code === 'Space') {
            e.preventDefault();
            startGame();
            return;
        }
    }

    if (gameState !== 'PLAYING') return;

    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        player.jump();
    }
    if (e.code === 'ArrowDown') {
        e.preventDefault();
        player.duck(true);
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowDown') {
        player.duck(false);
    }
});

// Screen Tap / Touch Controls
document.addEventListener('touchstart', (e) => {
    // Let button clicks function normally (like 'Start Game' or 'Try Again')
    if (e.target.tagName === 'BUTTON') return;

    // Prevent default scroll/zoom behaviors
    if (e.cancelable) e.preventDefault();

    if (gameState === 'START' || gameState === 'GAMEOVER') {
        startGame();
        return;
    }

    if (gameState === 'PLAYING') {
        let touchX = e.touches[0].clientX;
        let screenWidth = window.innerWidth;
        if (touchX > screenWidth / 2) {
            player.jump();
        } else {
            player.duck(true);
        }
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    if (e.cancelable) e.preventDefault();
    player.duck(false);
}, { passive: false });

// UI Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

function spawnEntities() {
    frameCount++;

    // Spawn Obstacle occasionally (every ~90 frames)
    if (frameCount % 90 === 0 && Math.random() > 0.3) {
        obstacles.push(new Obstacle());
    }

    // Spawn Gem occasionally (every ~120 frames)
    if (frameCount % 120 === 0) {
        gems.push(new Gem());
    }

    // Periodically increase speed
    if (frameCount % 1000 === 0) {
        baseSpeed += 0.5;
    }
}

function checkCollisions() {
    let pWidth = player.width;
    let pHeight = player.isDucking ? player.height / 2 : player.height;
    let pY = player.isDucking ? player.y + player.height / 2 : player.y;

    // Tighter hitbox for pixel-perfect feel
    let pPadX = pWidth * 0.25; // 25% padding on left and right sides
    let pPadTop = player.isDucking ? 20 : pHeight * 0.15; // padding top
    let pPadBot = pHeight * 0.05; // 5% padding bottom

    const pBox = {
        x: player.x + pPadX,
        y: pY + pPadTop,
        w: pWidth - (pPadX * 2),
        h: pHeight - pPadTop - pPadBot
    };

    // Check Obstacles
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        let oPadX = obs.width * 0.2;
        let oPadTop = obs.height * 0.1;
        let oBox = {
            x: obs.x + oPadX,
            y: obs.y + oPadTop,
            w: obs.width - (oPadX * 2),
            h: obs.height - oPadTop
        };

        if (
            pBox.x < oBox.x + oBox.w &&
            pBox.x + pBox.w > oBox.x &&
            pBox.y < oBox.y + oBox.h &&
            pBox.h + pBox.y > oBox.y
        ) {
            // Collision detected
            gameOver();
            return;
        }
    }

    // Check Gems (Collectibles)
    for (let i = gems.length - 1; i >= 0; i--) {
        let gem = gems[i];
        let gPad = gem.width * 0.2;
        let gBox = {
            x: gem.x + gPad,
            y: gem.y + gPad,
            w: gem.width - (gPad * 2),
            h: gem.height - (gPad * 2)
        };

        if (
            pBox.x < gBox.x + gBox.w &&
            pBox.x + pBox.w > gBox.x &&
            pBox.y < gBox.y + gBox.h &&
            pBox.h + pBox.y > gBox.y
        ) {
            // Collected gem
            score += 10;
            gemsCollected += 1;
            if (gemsCollected % 5 === 0) {
                baseSpeed += 1; // Increase speed every 5 gems
            }
            updateScore();
            gems.splice(i, 1);
        }
    }
}

function updateScore() {
    scoreDisplay.innerText = score;
    highScoreDisplay.innerText = highScore;
}

const levelPalettes = [
    { sky: '#87CEEB', ground: '#27ae60' }, // Level 0: Day
    { sky: '#FF7E67', ground: '#D35400' }, // Level 1: Sunset
    { sky: '#2C3E50', ground: '#145A32' }, // Level 2: Night
    { sky: '#1A1A2E', ground: '#16213E' }, // Level 3: Midnight
    { sky: '#E0B0FF', ground: '#800080' }  // Level 4: Magic
];

const backgroundElements = [];

function initBackgrounds() {
    backgroundElements.length = 0;
    // Parallax Layer 1: Islands / Mountains
    for (let i = 0; i < 4; i++) {
        backgroundElements.push({
            type: 'island',
            x: Math.random() * virtualWidth * 2,
            width: 150 + Math.random() * 250,
            height: 80 + Math.random() * 120,
            speed: 0.2 + Math.random() * 0.3
        });
    }
    // Parallax Layer 2: Clouds
    for (let i = 0; i < 6; i++) {
        backgroundElements.push({
            type: 'cloud',
            x: Math.random() * virtualWidth * 2,
            y: 20 + Math.random() * 150,
            width: 60 + Math.random() * 100,
            speed: 0.5 + Math.random() * 0.5
        });
    }
    // Parallax Layer 3: Birds
    for (let i = 0; i < 3; i++) {
        backgroundElements.push({
            type: 'bird',
            x: virtualWidth + Math.random() * 800,
            y: 40 + Math.random() * 120,
            speed: 1.5 + Math.random(),
            flap: Math.random() * Math.PI * 2
        });
    }
}
// Init once on load
setTimeout(initBackgrounds, 100);

function drawBackgroundElements(palette) {
    backgroundElements.forEach(el => {
        if (gameState === 'PLAYING') {
            el.x -= el.speed;
        }

        // Loop horizontally
        if (el.type === 'island' || el.type === 'cloud') {
            if (el.x + el.width < -100) {
                el.x = virtualWidth + Math.random() * 300;
            }
        } else if (el.type === 'bird') {
            if (el.x + 50 < -100) {
                el.x = virtualWidth + Math.random() * 800;
                el.y = 40 + Math.random() * 120;
            }
        }

        ctx.save();
        if (el.type === 'island') {
            // Silhouette island/mountain using ground color
            ctx.fillStyle = palette.ground;
            ctx.globalAlpha = 0.5; // push it to the background
            ctx.beginPath();
            ctx.moveTo(el.x, virtualHeight - 20);
            // Draw a mountain peak
            ctx.lineTo(el.x + el.width / 2, virtualHeight - 20 - el.height);
            ctx.lineTo(el.x + el.width, virtualHeight - 20);
            ctx.fill();
        } else if (el.type === 'cloud') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.arc(el.x, el.y, el.width / 3, 0, Math.PI * 2);
            ctx.arc(el.x + el.width / 3, el.y - el.width / 6, el.width / 2.5, 0, Math.PI * 2);
            ctx.arc(el.x + el.width * 0.6, el.y, el.width / 3.5, 0, Math.PI * 2);
            ctx.fill();
        } else if (el.type === 'bird') {
            if (gameState === 'PLAYING') {
                el.flap += 0.15;
            }
            let flyOffset = Math.sin(el.flap) * 10;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(el.x, el.y);
            ctx.quadraticCurveTo(el.x + 10, el.y - 12 + flyOffset, el.x + 20, el.y);
            ctx.quadraticCurveTo(el.x + 30, el.y - 12 + flyOffset, el.x + 40, el.y);
            ctx.stroke();
        }
        ctx.restore();
    });
}

function drawBackground() {
    // Determine level every 20 gems
    let level = Math.floor(gemsCollected / 20);
    let currentPalette = levelPalettes[level % levelPalettes.length];

    // Smoothly transition background color (sky)
    gameContainer.style.backgroundColor = currentPalette.sky;

    // Draw parallax background elements
    drawBackgroundElements(currentPalette);

    // Ground
    ctx.fillStyle = currentPalette.ground;
    ctx.fillRect(0, virtualHeight - 20, virtualWidth, 20);
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(gameScale, gameScale);

    drawBackground();

    player.update();
    player.draw();

    spawnEntities();

    // Update & Draw Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].update();
        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
            score += 1; // Passive score for surviving
            updateScore();
        }
    }

    // Update & Draw Gems
    for (let i = gems.length - 1; i >= 0; i--) {
        gems[i].update();
        if (gems[i].x + gems[i].width < 0) {
            gems.splice(i, 1);
        }
    }

    checkCollisions();

    if (gameState === 'PLAYING') {
        animationId = requestAnimationFrame(gameLoop);
    }
}

function startGame() {
    gameState = 'PLAYING';

    // Reset Variables
    score = 0;
    gemsCollected = 0;
    frameCount = 0;
    baseSpeed = 5;
    obstacles = [];
    gems = [];
    player.y = virtualHeight - 20 - player.height;
    player.vy = 0;
    player.jumpCount = 0;

    updateScore();

    // UI toggles
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');

    gameLoop();
}

function gameOver() {
    gameState = 'GAMEOVER';
    cancelAnimationFrame(animationId);

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('polynesianRunnerHighScore', highScore);
    }

    finalScoreDisplay.innerText = score;
    finalHighScoreDisplay.innerText = highScore;
    gameOverScreen.classList.remove('hidden');
}

// Initial draw (just background)
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.scale(gameScale, gameScale);
drawBackground();
