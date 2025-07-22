const TILES = {
    ground: '',
    wall: 'W',
    player: 'P',
    enemy: 'E',
    health: 'HP',
    sword: 'SW'
};

const FIELD_SIZE_WIDTH = 40,
FIELD_SIZE_HEIGHT = 24;

const FIELD_TILE_WIDTH = 50,
FIELD_TILE_HEIGHT = 50;

const TUNNEL_SPAWN_COUNT_RANGE = [3, 5],
ROOM_SPAWN_COUNT_RANGE = [5, 10],
ROOM_SIZE_RANGE = [3, 8];

const SWORDS_COUNT = 2,
HEALTH_POTIONS_COUNT = 10,
ENEMIS_COUNT = 10;

const DAMAGE_INCREMENT = 1,
HEALTH_INCREMENT = 1;

const LIVINGS = {
    [TILES.player]: {
        health: 3,
        damage: 1
    },
    [TILES.enemy]: {
        health: 1,
        damage: 1
    }
};

const KEY_BINDINGS = {
    KeyW: 'up',
    KeyS: 'down',
    KeyA: 'left',
    KeyD: 'right',
    Space: 'attack'
};

function addEvent(el, event, callback) {
    el.addEventListener(event, e => e.isTrusted && callback(e));
};

function callManyTimes(func, times) {
    for (let i = 0; i < times; i++) func();
};

class SeededRandom {
    #seed;

    constructor(seed = 1) {
        this.#seed = seed;
    };

    next() {
        this.#seed = (1664525 * this.#seed + 1013904223) % 4294967296;
        this.#seed = this.#seed >>> 0;
        return this.#seed / 4294967296;
    };
    
    random(min = 0, max = 1) {
        return min + this.next() * (max - min);
    };
    
    randomInt(min, max) {
        return Math.floor(this.random(min, max + 1));
    };

    randomEl(arr) {
        return arr[Math.floor(this.random() * arr.length)];
    };
};

class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    };

    clone() {
        return new Vector(this.x, this.y);
    };

    copy(v) {
        this.x = v.x;
        this.y = v.y;

        return this;
    };

    add(v) {
        this.x += v.x;
        this.y += v.y;

        return this;
    };

    equals(v) {
        return this.x === v.x && this.y === v.y;
    };
};

class Living {
    #maxHealth;
    #attackStrategy;
    #moveStrategy;
    #dieStrategy;

    constructor(position, type, health, damage) {
        const base = LIVINGS[type];

        this.position = new Vector(position.x, position.y);
        this.health = health || base.health;
        this.damage = damage || base.damage;
        this.#maxHealth = this.health;
    };

    getHealthPercentage() {
        return (this.health / this.#maxHealth * 100) | 0;
    };

    updateParameter(parameter, value) {
        switch (parameter) {
            case 'health':
                this.health = Math.min(this.health + value, this.#maxHealth);

                if(this.health <= 0 && this.#dieStrategy) this.#dieStrategy();

                break;
            case 'damage':
                this.damage = this.damage + value;

                break;
        };
    };

    setStrategy(type, strategy) {
        switch (type) {
            case 'attack':
                this.#attackStrategy = strategy;
                break;
            case 'move':
                this.#moveStrategy = strategy;
                break;
            case 'die':
                this.#dieStrategy = strategy;
                break;
        };
    };

    attack() {
        if(this.#attackStrategy) this.#attackStrategy();
    };

    move() {
        if(this.#moveStrategy) this.#moveStrategy();
    };

    dispose() {
        this.#attackStrategy = null;
        this.#moveStrategy = null;
        this.#dieStrategy = null;
    };
};

class Player extends Living {
    constructor(position, health, damage) {
        super(position, TILES.player, health, damage);
    };

    itemPickedUp(item) {
        switch (item) {
            case TILES.sword:
                this.updateParameter('damage', DAMAGE_INCREMENT);

                break;
            case TILES.health:
                this.updateParameter('health', HEALTH_INCREMENT);

                break;
        };
    };
};

class Enemy extends Living {
    constructor(position, health, damage) {
        super(position, TILES.enemy, health, damage);
    };
};

class CollisionResult {
    constructor(result = false, tile) {
        this.result = result;
        this.tile = tile;
    };
};

class Game {
    #seed;
    #seededRandom;
    #fieldElement;
    #field;
    #player;
    #enemies;
    #currentLevel = 0;

    init(seed) {
        this.#fieldElement = document.body.querySelector('.field');

        this.#seed = seed;

        this.#initLevel();

        this.#initInput();

        this.#render();
    };

    #initLevel() {
        this.#seededRandom = new SeededRandom(this.#seed + this.#currentLevel);

        this.#createField();
        
        this.#createTunnels();

        this.#createRooms();

        this.#createItems();

        this.#createPlayer();

        this.#createEnemies();
    };

    #createField() {
        this.#field = [];

        for (let y = 0; y < FIELD_SIZE_HEIGHT; y++) {
            this.#field[y] = [];

            for (let x = 0; x < FIELD_SIZE_WIDTH; x++) this.#field[y][x] = TILES.wall;
        };
    };
   
    #createTunnels() {
        for (const type of ['horizontal','vertical']) callManyTimes(
            () => this.#createTunnel(type),
            this.#seededRandom.randomInt(...TUNNEL_SPAWN_COUNT_RANGE)
        );
    };

    #createTunnel(type) {
        switch (type) {
            case 'horizontal':
                this.#field[this.#seededRandom.randomInt(0, FIELD_SIZE_HEIGHT - 1)] = new Array(FIELD_SIZE_WIDTH).fill(TILES.ground);

                break;
            case 'vertical':
                const tunnelPosition = this.#findRandom(this.#field, el => el.includes(TILES.ground));

                for (let y = 0; y < FIELD_SIZE_HEIGHT; y++) this.#field[y][tunnelPosition] = TILES.ground;

                break;
        };
    };

    #createRooms(count = this.#seededRandom.randomInt(...ROOM_SPAWN_COUNT_RANGE)) {
        callManyTimes(this.#createRoom.bind(this), count);
    };

    #createRoom() {
        const width = this.#seededRandom.randomInt(...ROOM_SIZE_RANGE),
        height = this.#seededRandom.randomInt(...ROOM_SIZE_RANGE),
        x = this.#seededRandom.randomInt(0, FIELD_SIZE_WIDTH - width),
        y = this.#seededRandom.randomInt(0, FIELD_SIZE_HEIGHT - height);

        for (let column = y; column < y + height; column++) {
            if(!this.#field[column]) break;
    
            for (let row = x; row < x + width; row++) {
                if(this.#field[column][row] !== undefined) this.#field[column][row] = TILES.ground;
            };
        };
    
        let closestPoint = null,
        minDistance = Infinity;

        for (let checkY = 0; checkY < FIELD_SIZE_HEIGHT; checkY++) {
            for (let checkX = 0; checkX < FIELD_SIZE_WIDTH; checkX++) {
                if(this.#field[checkY][checkX] === TILES.ground) {
                    if(checkX < x || checkX >= x + width || checkY < y || checkY >= y + height) {
                        const distance = Math.abs(checkX - x) + Math.abs(checkY - y);

                        if(distance < minDistance) {
                            minDistance = distance;
                            closestPoint = new Vector(checkX, checkY);
                        };
                    };
                };
            };
        };

        if(closestPoint) {
            const startX = x + Math.floor(width / 2),
            startY = y + Math.floor(height / 2);
            
            for (let corridorX = startX; corridorX !== closestPoint.x; corridorX += closestPoint.x > startX ? 1 : -1) {
                if(this.#validatePlace(new Vector(corridorX, startY))) this.#field[startY][corridorX] = TILES.ground;
            };

            for (let corridorY = startY; corridorY !== closestPoint.y; corridorY += closestPoint.y > startY ? 1 : -1) {
                if(this.#validatePlace(new Vector(closestPoint.x, corridorY))) this.#field[corridorY][closestPoint.x] = TILES.ground;
            };
        };
    };

    #createItems(swordsCount = SWORDS_COUNT, healthPotionsCount = HEALTH_POTIONS_COUNT) {
        callManyTimes(() => this.#createItem(TILES.sword), swordsCount);

        callManyTimes(() => this.#createItem(TILES.health), healthPotionsCount);
    };

    #createItem(type) {
        this.#createTileRandom(type);
    };

    #createTileRandom(type) {
        const position = this.#findRandomSpawnPlace();

        if(!position) return;

        this.#field[position.y][position.x] = type;

        return position;
    };

    #findRandomSpawnPlace() {
        const y = this.#findRandom(this.#field, el => el.includes(TILES.ground));

        if(y === undefined) return;
        
        const x = this.#findRandom(this.#field[y], el => el === TILES.ground);

        if(x === undefined) return;

        return new Vector(x, y);
    };

    #findRandom(arr, predicate) {
        return this.#seededRandom.randomEl(arr.map((el, index) => {
            if(predicate(el)) return index;
            else return -1;
        }).filter(x => x !== -1));
    };

    #createPlayer() {
        this.#player = new Player(this.#createTileRandom(TILES.player));
        
        this.#player.setStrategy('attack', () => {
            const attackPositions = this.#getPlacesAround(this.#player.position);

            this.#enemies
            .filter(enemy => 
                attackPositions
                .some(position => enemy.position.equals(new Vector(...position)))
            )
            .forEach(enemy => enemy.updateParameter('health', -this.#player.damage));
        });
        this.#player.setStrategy('die', this.#lose.bind(this));
    };

    #createEnemies(count = ENEMIS_COUNT) {
        this.#enemies = [];

        callManyTimes(this.#createEnemy.bind(this), count);
    };

    #createEnemy() {
        const spawnPosition = this.#createTileRandom(TILES.enemy);

        if(!spawnPosition) return;

        const enemy = new Enemy(spawnPosition);

        enemy.setStrategy('move', () => {
            const placesAround = this.#getPlacesAround(enemy.position),
            randomPlace = placesAround[this.#findRandom(
                placesAround,
                ([x, y]) => this.#validatePlace({ x, y }) && this.#field[y][x] === TILES.ground
            )];

            if(!randomPlace) return;

            this.#field[enemy.position.y][enemy.position.x] = TILES.ground;
            this.#field[randomPlace[1]][randomPlace[0]] = TILES.enemy;

            enemy.position.x = randomPlace[0];
            enemy.position.y = randomPlace[1];
        });
        enemy.setStrategy('attack', () => {
            if(
                this.#getPlacesAround(enemy.position)
                .some(position => (position[0] === this.#player.position.x) && (position[1] === this.#player.position.y))
            ) this.#player.updateParameter('health', -enemy.damage);
        });
        enemy.setStrategy('die', () => {
            this.#field[enemy.position.y][enemy.position.x] = TILES.ground;

            enemy.dispose();

            this.#enemies.splice(this.#enemies.findIndex(x => x.position.equals(enemy.position)), 1);

            if(!this.#enemies.length) this.#win();
        });

        this.#field[enemy.position.y][enemy.position.x] = TILES.enemy;

        this.#enemies.push(enemy);
    };

    #getPlacesAround({ x, y }) {
        return [
            [x - 1, y],
            [x + 1, y],
            [x, y - 1],
            [x, y + 1]
        ];
    };

    #initInput() {
        addEvent(document, 'keydown', this.#processInput.bind(this));
    };

    #processInput(e) {
        if(this.#player.health <= 0) return;

        const keyBinding = KEY_BINDINGS[e.code];

        if(!keyBinding) return;

        let dx = 0,
        dy = 0,
        attack = false;

        switch (keyBinding) {
            case 'up':
                dy = -1;
                break;
            case 'down':
                dy = 1;
                break;
            case 'left':
                dx = -1;
                break;
            case 'right':
                dx = 1;
                break;
            case 'attack':
                attack = true;
                break;
        };

        this.#step(dx, dy, attack);
    };

    #step(dx, dy, attack) {
        this.#updateLiving(dx, dy, attack);

        this.#render();
    };

    #updateLiving(dx, dy, attack) {
        if(!this.#updatePlayer(dx, dy, attack)) return;

        this.#updateEnemies();
    };

    #updatePlayer(dx, dy, attack) {
        this.#field[this.#player.position.y][this.#player.position.x] = TILES.ground;

        const nextPosition = this.#player.position.clone().add(new Vector(dx, dy)),
        hit = this.#checkCollisions(nextPosition);

        if(hit.result) {
            this.#player.position.copy(nextPosition);

            if(hit.tile !== TILES.ground) this.#player.itemPickedUp(hit.tile);
        };

        if(this.#validatePlace(this.#player.position)) this.#field[this.#player.position.y][this.#player.position.x] = TILES.player;

        if(attack) this.#player.attack();

        return hit.result;
    };

    #validatePlace({ x, y }) {
        return this.#field[y] && this.#field[y][x] !== undefined;
    };

    #updateEnemies() {
        this.#enemies.forEach(enemy => {
            enemy.move();

            enemy.attack();
        });
    };

    #checkCollisions({ x, y }) {
        if(!this.#field[y]) return new CollisionResult();

        const tile = this.#field[y][x];

        return new CollisionResult(
            tile === TILES.ground || tile === TILES.sword || tile === TILES.health,
            tile
        );
    };

    #getEnemy(x, y) {
        return this.#enemies.find(enemy => enemy.position.equals({ x, y }));
    };

    #render() {
        this.#fieldElement.innerHTML = '';

        for (let y = 0; y < FIELD_SIZE_HEIGHT; y++) {
            for (let x = 0; x < FIELD_SIZE_WIDTH; x++) {
                const tile = this.#field[y][x],
                tileElement = document.createElement('div');
                tileElement.className = `tile tile${this.#field[y][x]}`;
                tileElement.style.left = `${FIELD_TILE_WIDTH * x}px`;
                tileElement.style.top = `${FIELD_TILE_HEIGHT * y}px`;
                
                if(tile === TILES.player || tile === TILES.enemy) tileElement.innerHTML = `<div class="health" style="width:${
                    (tile === TILES.player ? this.#player : this.#getEnemy(x, y))
                    .getHealthPercentage()
                }%"></div>`;

                this.#fieldElement.append(tileElement);
            };
        };
    };

    #win() {
        this.#currentLevel++;

        this.#restart();
    };

    #lose() {
        this.#currentLevel = 0;

        this.#restart();
    };

    #restart() {
        this.#enemies.forEach(enemy => {
            enemy.setStrategy('attack', null);
            enemy.setStrategy('move', null);
            enemy.setStrategy('die', null);
            enemy.dispose();
        });
        this.#enemies = [];
        
        if(this.#player) {
            this.#player.setStrategy('attack', null);
            this.#player.setStrategy('die', null);
            this.#player = null;
        };

        this.#initLevel();
    };
};

window.Game = Game;