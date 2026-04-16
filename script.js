const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ballImage = new Image();
ballImage.src = 'picaxe.png'; 

const paddleImg = new Image();
paddleImg.src = 'paddle.png'; 

const blockTypes = {
    1: 'dirt.jpg',
    2: 'stone.jpg',
    3: 'deepslate.jpg',
    4: 'obsidian.jpg',
    5: 'bedrock.jpg'
};

const brickImages = {};
for (let health = 1; health <= 5; health++) {
    let img = new Image();
    img.src = blockTypes[health]; 
    brickImages[health] = img; 
}

const GAMESTATE = {
    PLAYING: 0,
    GAMEOVER: 1,
    MENU: 2,
    READY: 3,
    PAUSED: 4,
    VICTORY: 5 
};

class InputHandler {
    constructor() {
        this.keys = [];
        window.addEventListener('keydown', e => {
            if (e.code === 'Space') {
                e.preventDefault(); 
                if (game && game.gamestate !== GAMESTATE.MENU) {
                    game.resetToMenu();
                }
            }

            if (game && game.gamestate === GAMESTATE.READY) {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    game.gamestate = GAMESTATE.PLAYING;
                    game.startTimer(); 
                    document.getElementById('startMenu').style.display = 'none'; 
                }
            }

            if (game && (e.key === 'p' || e.key === 'P' || e.key === 'Escape')) {
                game.togglePause();
            }

            if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && this.keys.indexOf(e.key) === -1) {
                this.keys.push(e.key);
            }
        });
        window.addEventListener('keyup', e => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                this.keys.splice(this.keys.indexOf(e.key), 1);
            }
        });
    }
}

class Paddle {
    constructor(gameWidth, gameHeight) {
        this.width = 100;
        this.height = 20;
        this.x = gameWidth / 2 - this.width / 2;
        this.y = gameHeight - this.height - 30; 
        this.speed = 0;
        this.maxSpeed = 6; 
    }
    update(input) {
        if (input.keys.includes('ArrowLeft')) this.speed = -this.maxSpeed;
        else if (input.keys.includes('ArrowRight')) this.speed = this.maxSpeed;
        else this.speed = 0;

        this.x += this.speed;
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
    }
    draw(ctx) {
        ctx.drawImage(paddleImg, this.x, this.y, this.width, this.height);
    }
}

class Ball {
    constructor(x, y, radius = 15) { 
        this.radius = radius;
        this.x = x;
        this.y = y;
        this.dx = 0; 
        this.dy = 0; 
        this.markedForDeletion = false;
    }
    update(paddle) {
        this.x += this.dx;
        this.y += this.dy;

        if (this.x + this.radius > canvas.width || this.x - this.radius < 0) this.dx *= -1;
        if (this.y - this.radius < 0) this.dy *= -1;
        if (this.y + this.radius > canvas.height) this.markedForDeletion = true; 

        let closestX = Math.max(paddle.x, Math.min(this.x, paddle.x + paddle.width));
        let closestY = Math.max(paddle.y, Math.min(this.y, paddle.y + paddle.height));

        let distanceX = this.x - closestX;
        let distanceY = this.y - closestY;
        let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

        if (distanceSquared < (this.radius * this.radius)) {
            if (closestY === paddle.y || closestY === paddle.y + paddle.height) {
                this.dy *= -1; 
                if (closestY === paddle.y) {
                    this.y = paddle.y - this.radius; 
                    let hitPoint = this.x - (paddle.x + paddle.width / 2);
                    this.dx = hitPoint * 0.03; 
                } else {
                    this.y = paddle.y + paddle.height + this.radius; 
                }
            } 
            else if (closestX === paddle.x || closestX === paddle.x + paddle.width) {
                this.dx *= -1; 
                if (closestX === paddle.x) this.x = paddle.x - this.radius; 
                else this.x = paddle.x + paddle.width + this.radius; 
            }
        }
    }
    draw(ctx) {
        let size = this.radius * 2;
        let angle = Math.atan2(this.dy, this.dx);
        angle += Math.PI / 2; 

        ctx.save(); 
        ctx.translate(this.x, this.y); 
        ctx.rotate(angle); 
        ctx.drawImage(ballImage, -this.radius, -this.radius, size, size);
        ctx.restore(); 
    }
}

class Brick {
    constructor(x, y, width, height, health) { 
        this.x = x;
        this.y = y;
        this.width = width;  
        this.height = height; 
        this.health = health; 
        this.active = true;
    }
    
    draw(ctx) {
        if (!this.active) return;
        let currentImage = brickImages[this.health];
        ctx.drawImage(currentImage, this.x, this.y, this.width, this.height);
        
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
}

class PowerUp {
    constructor(x, y, type, color, speed) { 
        this.x = x; 
        this.y = y;
        this.width = 40;
        this.height = 15;
        this.speed = speed; 
        this.type = type; 
        this.color = color;
        this.markedForDeletion = false;
    }
    update() {
        this.y += this.speed;
        if (this.y > canvas.height) this.markedForDeletion = true;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Game {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.gamestate = GAMESTATE.MENU; 
        
        this.input = new InputHandler();
        this.paddle = new Paddle(this.width, this.height);
        
        this.baseBallRadius = 15; 
        this.balls = [new Ball(this.width / 2, this.height - 70, this.baseBallRadius)]; 
        this.bricks = [];
        this.powerUps = [];

        this.score = 0;
        this.timeSeconds = 0;
        this.timerInterval = null;
        
        this.playerName = "Anonymous";
        this.difficulty = "medium";
        this.scoreSaved = false; 
    }

    resetToMenu() {
        this.gamestate = GAMESTATE.MENU;
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.timeSeconds = 0;
        this.score = 0;
        this.updateTimeUI();
        document.getElementById('scoreDisplay').innerText = "0";

        this.paddle = new Paddle(this.width, this.height);
        this.baseBallRadius = 15; 
        this.balls = [new Ball(this.width / 2, this.height - 70, this.baseBallRadius)];
        this.bricks = [];
        this.powerUps = [];
        this.scoreSaved = false;

        document.getElementById('startMenu').style.display = 'flex';
        document.getElementById('difficultyButtons').style.display = 'flex';
        document.getElementById('playerNameInput').style.display = 'block';
        document.getElementById('btnGuide').style.display = 'block'; 
        document.getElementById('startPrompt').style.display = 'none';
        
        document.getElementById('btnPause').style.display = 'none';
        document.getElementById('btnPause').innerText = "PAUSE";
        document.getElementById('btnPause').style.backgroundColor = "#555";
    }

    startTimer() {
        if (!this.timerInterval) {
            this.timerInterval = setInterval(() => {
                if (this.gamestate === GAMESTATE.PLAYING) {
                    this.timeSeconds++;
                    this.updateTimeUI();
                }
            }, 1000);
        }
    }

    updateTimeUI() {
        let minutes = Math.floor(this.timeSeconds / 60).toString().padStart(2, '0');
        let seconds = (this.timeSeconds % 60).toString().padStart(2, '0');
        document.getElementById('timeDisplay').innerText = `${minutes}:${seconds}`;
    }

    addScore(points) {
        this.score += points;
        document.getElementById('scoreDisplay').innerText = this.score;
    }

    getRandomHealth() {
        const rand = Math.random();
        
        if (this.difficulty === 'easy') {
            if (rand < 0.6) return 1; 
            return 2; 
        } else if (this.difficulty === 'medium') {
            if (rand < 0.3) return 1;
            if (rand < 0.6) return 2;
            if (rand < 0.9) return 3;
            return 4;
        } else {
            if (rand < 0.2) return 1;
            if (rand < 0.4) return 2;
            if (rand < 0.6) return 3;
            if (rand < 0.8) return 4;
            return 5;
        }
    }

    initBricks(rows, cols) {
        this.bricks = []; 
        const padding = 10;
        const sideMargin = 40; 
        const topMargin = 50;  
        const targetGridHeight = 250; 

        const availableWidth = this.width - (sideMargin * 2);
        const brickWidth = (availableWidth - (padding * (cols - 1))) / cols;
        const brickHeight = (targetGridHeight - (padding * (rows - 1))) / rows;

        this.baseBallRadius = brickHeight * 0.4; 
        
        if (this.balls.length > 0) {
            this.balls[0].radius = this.baseBallRadius;
        }

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let brickX = c * (brickWidth + padding) + sideMargin;
                let brickY = r * (brickHeight + padding) + topMargin;
                
                let health = this.getRandomHealth();
                this.bricks.push(new Brick(brickX, brickY, brickWidth, brickHeight, health));
            }
        }
    }

    togglePause() {
        if (this.gamestate === GAMESTATE.PLAYING) {
            this.gamestate = GAMESTATE.PAUSED;
            document.getElementById('btnPause').innerText = "RESUME";
            document.getElementById('btnPause').style.backgroundColor = "#ffaa00"; 
        } else if (this.gamestate === GAMESTATE.PAUSED) {
            this.gamestate = GAMESTATE.PLAYING;
            document.getElementById('btnPause').innerText = "PAUSE";
            document.getElementById('btnPause').style.backgroundColor = "#555";
        }
    }

    update() {
        if (this.gamestate === GAMESTATE.GAMEOVER || 
            this.gamestate === GAMESTATE.VICTORY ||
            this.gamestate === GAMESTATE.MENU || 
            this.gamestate === GAMESTATE.READY ||
            this.gamestate === GAMESTATE.PAUSED) return;

        this.paddle.update(this.input);
        
        for (let i = 0; i < this.balls.length; i++) {
            for (let j = i + 1; j < this.balls.length; j++) {
                let b1 = this.balls[i];
                let b2 = this.balls[j];
                let dx = b2.x - b1.x;
                let dy = b2.y - b1.y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance === 0) {
                    dx = 0.01; dy = 0.01;
                    distance = Math.sqrt(dx * dx + dy * dy);
                }

                let combinedRadii = b1.radius + b2.radius;

                if (distance < combinedRadii) {
                    let overlap = combinedRadii - distance;
                    let nx = dx / distance; 
                    let ny = dy / distance; 

                    b1.x -= nx * (overlap / 2);
                    b1.y -= ny * (overlap / 2);
                    b2.x += nx * (overlap / 2);
                    b2.y += ny * (overlap / 2);

                    let kx = b1.dx - b2.dx;
                    let ky = b1.dy - b2.dy;
                    let p = 2 * (nx * kx + ny * ky) / 2;
                    
                    b1.dx -= p * nx; b1.dy -= p * ny;
                    b2.dx += p * nx; b2.dy += p * ny;
                }
            }
        }

        this.balls.forEach(ball => {
            ball.update(this.paddle);

            this.bricks.forEach(brick => {
                if (brick.active) {
                    let closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
                    let closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
                    let distanceX = ball.x - closestX;
                    let distanceY = ball.y - closestY;
                    let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

                    if (distanceSquared < (ball.radius * ball.radius)) {
                        
                        if (closestX === brick.x || closestX === brick.x + brick.width) ball.dx *= -1;
                        if (closestY === brick.y || closestY === brick.y + brick.height) ball.dy *= -1;

                        this.addScore(10); 
                        brick.health--;    

                        if (brick.health <= 0) {
                            brick.active = false; 

                            if (Math.random() < 0.15) { 
                                // --- POWER UP COLORS MATCH THE ORANGE/WHITE THEME ---
                                const cards = [
                                    { type: "MULTI_BALL", color: "#ffaa00", speed: 1.2 }, 
                                    { type: "EXPAND", color: "#ffffff", speed: 1.2 }       
                                ];
                                let card = cards[Math.floor(Math.random() * cards.length)];
                                let powerUpX = brick.x + (brick.width / 2) - 20; 
                                this.powerUps.push(new PowerUp(powerUpX, brick.y, card.type, card.color, card.speed));
                            }
                        }
                    }
                }
            });
        });

        this.powerUps.forEach(powerUp => {
            powerUp.update();

            if (powerUp.y + powerUp.height >= this.paddle.y &&
                powerUp.x + powerUp.width >= this.paddle.x &&
                powerUp.x <= this.paddle.x + this.paddle.width) {
                
                switch(powerUp.type) {
                    case "MULTI_BALL":
                        let ball1 = new Ball(this.paddle.x + this.paddle.width / 2 - 10, this.paddle.y - 15, this.baseBallRadius);
                        let ball2 = new Ball(this.paddle.x + this.paddle.width / 2 + 10, this.paddle.y - 15, this.baseBallRadius);
                        let baseSpeed = Math.abs(this.balls[0].dy); 
                        ball1.dx = (Math.random() * baseSpeed) + (baseSpeed * 0.5); 
                        ball1.dy = -baseSpeed; 
                        ball2.dx = -(Math.random() * baseSpeed) - (baseSpeed * 0.5); 
                        ball2.dy = -baseSpeed; 
                        this.balls.push(ball1);
                        this.balls.push(ball2);
                        this.addScore(25);
                        break;
                    case "EXPAND":
                        this.paddle.width += 50; 
                        setTimeout(() => this.paddle.width -= 50, 10000); 
                        this.addScore(25);
                        break;
                }
                powerUp.markedForDeletion = true; 
            }
        });

        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            if (this.powerUps[i].markedForDeletion) {
                this.powerUps.splice(i, 1);
            }
        }

        for (let i = this.balls.length - 1; i >= 0; i--) {
            if (this.balls[i].markedForDeletion) {
                this.balls.splice(i, 1);
            }
        }
        
        if (this.balls.length === 0) {
            this.gamestate = GAMESTATE.GAMEOVER;
            
            if (!this.scoreSaved) {
                saveScoreToLocal(this.difficulty, this.playerName, this.score, this.timeSeconds);
                renderLeaderboard(this.difficulty);
                this.scoreSaved = true;
            }
        }

        let bricksLeft = this.bricks.filter(brick => brick.active).length;
        if (bricksLeft === 0 && this.bricks.length > 0) {
            this.gamestate = GAMESTATE.VICTORY;
            
            if (!this.scoreSaved) {
                this.addScore(100); 
                saveScoreToLocal(this.difficulty, this.playerName, this.score, this.timeSeconds);
                renderLeaderboard(this.difficulty);
                this.scoreSaved = true;
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = "#BFB7E1"; 
        ctx.fillRect(0, 0, this.width, this.height);

        this.paddle.draw(ctx);
        this.powerUps.forEach(powerUp => powerUp.draw(ctx)); 
        this.balls.forEach(ball => ball.draw(ctx));
        this.bricks.forEach(brick => brick.draw(ctx));

        if (this.gamestate === GAMESTATE.PAUSED) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; 
            ctx.fillRect(0, 0, this.width, this.height);

            ctx.font = "bold 40px 'Courier New'";
            ctx.fillStyle = "#ffaa00"; // --- NOW ORANGE ---
            ctx.textAlign = "center";
            ctx.fillText("PAUSED", this.width / 2, this.height / 2);
        }

        if (this.gamestate === GAMESTATE.GAMEOVER) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; 
            ctx.fillRect(0, 0, this.width, this.height);

            ctx.font = "bold 50px 'Courier New'";
            ctx.fillStyle = "#ffaa00"; // --- NOW ORANGE ---
            ctx.textAlign = "center";
            ctx.fillText("GAME OVER", this.width / 2, this.height / 2 - 20);
            
            ctx.font = "20px 'Courier New'";
            ctx.fillStyle = "white";
            ctx.fillText("Press SPACE to return to Menu", this.width / 2, this.height / 2 + 30);
        }

        if (this.gamestate === GAMESTATE.VICTORY) {
            ctx.fillStyle = 'rgba(0, 50, 0, 0.8)'; 
            ctx.fillRect(0, 0, this.width, this.height);

            ctx.font = "bold 50px 'Courier New'";
            ctx.fillStyle = "#ffaa00"; // --- NOW ORANGE ---
            ctx.textAlign = "center";
            ctx.fillText("VICTORY!", this.width / 2, this.height / 2 - 20);
            
            ctx.font = "20px 'Courier New'";
            ctx.fillStyle = "white";
            ctx.fillText("Press SPACE to return to Menu", this.width / 2, this.height / 2 + 30);
        }
    }
}

const LEADERBOARD_KEY = 'mineBrickLeaderboard';

function saveScoreToLocal(difficulty, name, score, time) {
    let data = JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || {};
    if (!data[difficulty]) data[difficulty] = [];
    data[difficulty].push({ name, score, time });

    data[difficulty].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.time - b.time; 
    });

    data[difficulty] = data[difficulty].slice(0, 5);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(data));
}

function renderLeaderboard(difficulty) {
    const list = document.getElementById('leaderboardList');
    const title = document.getElementById('leaderboardTitle');
    
    let data = JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || {};
    let records = data[difficulty] || [];

    title.innerText = `TOP 5 (${difficulty.toUpperCase()})`;
    list.innerHTML = ''; 

    if (records.length === 0) {
        list.innerHTML = '<li>No records yet!</li>';
        return;
    }

    records.forEach((entry, index) => {
        const li = document.createElement('li');
        let minutes = Math.floor(entry.time / 60).toString().padStart(2, '0');
        let seconds = (entry.time % 60).toString().padStart(2, '0');

        li.innerText = `${entry.name}: ${entry.score}pt [${minutes}:${seconds}]`;

        if (index === 0) li.className = 'rank-1';
        else if (index === 1) li.className = 'rank-2';
        else if (index === 2) li.className = 'rank-3';
        else li.className = 'rank-normal';

        list.appendChild(li);
    });
}

let game; 

window.addEventListener('load', () => {
    game = new Game(canvas.width, canvas.height);
    
    document.getElementById('btnPause').addEventListener('click', () => {
        if (game) game.togglePause();
        document.getElementById('btnPause').blur(); 
    });

    document.getElementById('btnGuide').addEventListener('click', () => {
        document.getElementById('guideOverlay').style.display = 'flex';
    });

    document.getElementById('btnCloseGuide').addEventListener('click', () => {
        document.getElementById('guideOverlay').style.display = 'none';
    });

    function setDifficulty(level) {
        let inputName = document.getElementById('playerNameInput').value.trim();
        if (inputName === "") {
            inputName = "anon#" + Math.floor(Math.random() * 1000);
        }
        
        game.playerName = inputName;
        game.difficulty = level; 

        const b = game.balls[0];
        const p = game.paddle;

        if (level === 'easy') {
            p.width = 150; b.dx = 1.2; b.dy = -1.2; game.initBricks(3, 6);        
        } else if (level === 'medium') {
            p.width = 120; b.dx = 2.2; b.dy = -2.2; game.initBricks(5, 8);        
        } else if (level === 'hard') {
            p.width = 100; b.dx = 3.2; b.dy = -3.2; game.initBricks(8, 12);       
        }

        p.x = game.width / 2 - p.width / 2;
        b.x = p.x + p.width / 2;

        document.getElementById('difficultyButtons').style.display = 'none';
        document.getElementById('playerNameInput').style.display = 'none'; 
        document.getElementById('btnGuide').style.display = 'none'; 
        document.getElementById('startPrompt').style.display = 'block';
        document.getElementById('btnPause').style.display = 'block';
        
        game.gamestate = GAMESTATE.READY;
        renderLeaderboard(level);
    }

    document.getElementById('btnEasy').addEventListener('click', () => setDifficulty('easy'));
    document.getElementById('btnMedium').addEventListener('click', () => setDifficulty('medium'));
    document.getElementById('btnHard').addEventListener('click', () => setDifficulty('hard'));

    animate();
});

function animate() {
    game.update();
    game.draw(ctx);
    requestAnimationFrame(animate);
}