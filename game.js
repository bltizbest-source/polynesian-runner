import {createTempleScene} from './temple.js';
const canvas = document.getElementById('world');
let draw;
try { draw = createTempleScene(canvas); }
catch (error) {
    console.warn('Using the canvas renderer', error);
    const fallback = canvas.cloneNode();
    canvas.replaceWith(fallback);
    draw = createScene(fallback, 1.55);
}
const el = id => document.getElementById(id);
const storageKey = 'polynesianRunnerHighScore';
let best = 0;
try { best = Math.max(0, Number(localStorage.getItem(storageKey)) || 0); } catch {}
el('best').textContent = best;

let state = 'start', distance = 0, score = 0, obstacleCount = 0;
let entities = [], nextObstacle = 0, time = 0, menuBlend = 1;
const laneWidth = 1.55;
const player = { x: 0, lane: 0, y: 0, velocity: 0, jumps: 0, duck: false, crouch: 0 };
// Lead measures clear ground between the beast's muzzle and the runner.
const chase = {lead:1, x:1.06, stride:0, stumble:0, hold:0, closingSpeed:0};
const gestures = new Map();
let slideTime = 0;
let duckKey = false;

function fillCourse() {
    while (nextObstacle < distance + 145) {
        const lane = obstacleCount === 0 ? 0 : Math.floor(Math.random()*3)-1;
        const gemLane = lane === 0 ? (Math.random()<.5 ? -1 : 1) : 0;
        for (const lead of [9,6,3]) entities.push({kind:'gem', at:nextObstacle-lead, x:gemLane*laneWidth});
        entities.push({kind:obstacleCount % 2 ? 'gate' : 'barrier', at:nextObstacle, x:lane*laneWidth});
        obstacleCount++;
        nextObstacle += 18 + Math.random()*9 + Math.min(distance/190, 6);
    }
}
nextObstacle = 24;
fillCourse();

function clearInput() {
    duckKey = false;
    gestures.clear();
    slideTime = 0;
    player.duck = false;
}
function start() {
    if (state !== 'start' && state !== 'over') return;
    state = 'playing';
    document.body.dataset.state = state;
    distance = score = obstacleCount = 0;
    entities = [];
    nextObstacle = 24;
    fillCourse();
    clearInput();
    Object.assign(player, {x:0, lane:0, y:0, velocity:0, jumps:0, crouch:0});
    Object.assign(chase, {lead:1, x:1.06, stride:0, stumble:0, hold:0, closingSpeed:0});
    el('menu').hidden = true;
    el('live').hidden = false;
    el('lead-hud').hidden = false;
    el('lead').textContent = '1 m';
    el('score').textContent = 0;
}
function end() {
    state = 'over';
    document.body.dataset.state = state;
    clearInput();
    if (score > best) {
        best = score;
        try { localStorage.setItem(storageKey, best); } catch {}
    }
    el('best').textContent = best;
    el('live').hidden = true;
    el('lead-hud').hidden = true;
    el('title').textContent = 'Caught!';
    el('description').textContent = 'Score ' + score + '  ·  Distance ' + Math.floor(distance) + ' m';
    el('start-label').textContent = 'Run again';
    el('home').hidden = false;
    el('menu').hidden = false;
    el('start').focus({preventScroll:true});
}
function jump() {
    if (!player.duck && player.jumps < 2) {
        player.velocity = 6.2;
        player.jumps++;
    }
}
el('start').addEventListener('click', start);
el('help').addEventListener('click', () => el('guide').showModal());
el('home').addEventListener('click', () => {
    state = 'start';
    document.body.dataset.state = state;
    distance = obstacleCount = 0;
    entities = [];
    nextObstacle = 24;
    fillCourse();
    Object.assign(player, {x:0, lane:0, y:0, crouch:0});
    chase.stumble = 0;
    el('title').innerHTML = 'Temple<br><em>Passage</em>';
    el('description').textContent = 'Chase the gold through ancient gates on an endless jungle run.';
    el('start-label').textContent = 'Start run';
    el('home').hidden = true;
    el('start').focus();
});
function changeLane(direction) {
    player.lane = Math.max(-1, Math.min(1, player.lane + direction));
}
document.addEventListener('keydown', e => {
    if (el('guide').open || (e.code === 'Space' && e.target.closest('button'))) return;
    if (!['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) return;
    e.preventDefault();
    if (e.repeat) return;
    if (state !== 'playing') {
        if (e.code === 'Space') start();
    } else if (e.code === 'ArrowDown') duckKey = true;
    else if (e.code === 'ArrowLeft') changeLane(-1);
    else if (e.code === 'ArrowRight') changeLane(1);
    else jump();
});
document.addEventListener('keyup', e => { if(e.code === 'ArrowDown') duckKey = false; });
document.addEventListener('pointerdown', e => {
    if (e.target.closest('button') || e.button !== 0) return;
    if (state !== 'playing') return;
    gestures.set(e.pointerId, {x:e.clientX, y:e.clientY, start:performance.now(), used:false});
});
function readSwipe(e) {
    const g = gestures.get(e.pointerId);
    if (!g || g.used) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    g.used = true;
    if (Math.abs(dx) > Math.abs(dy)) changeLane(Math.sign(dx));
    else if (dy > 0) slideTime = .85;
    else jump();
}
window.addEventListener('pointermove', readSwipe);
window.addEventListener('pointerup', e => {
    readSwipe(e);
    const g = gestures.get(e.pointerId);
    if (g && !g.used && g.x > innerWidth/2) jump();
    gestures.delete(e.pointerId);
});
window.addEventListener('pointercancel', e => gestures.delete(e.pointerId));
let lastFrame;
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { clearInput(); lastFrame = undefined; });

function advance(dt) {
    const speed = 8 + Math.min(distance / 160, 6);
    distance += dt * speed;
    // The beast initially loses ground, then matches pace at a trailing distance.
    const gain = (.55 + speed - 8) * Math.exp(-chase.lead / 8) * dt;
    chase.lead += gain;
    chase.stride += speed*dt - gain;
    chase.x += (1.06 + player.x*.34 - chase.x)*(1-Math.exp(-3.1*dt));
    player.y = Math.max(0, player.y + player.velocity*dt - 8*dt*dt);
    player.velocity = player.y ? player.velocity - 16*dt : 0;
    if (!player.y) player.jumps = 0;
    slideTime = Math.max(0, slideTime-dt);
    const holdingLeft = Array.from(gestures.values()).some(g =>
        !g.used && g.x <= innerWidth/2 && performance.now()-g.start > 100);
    player.duck = player.y === 0 && (duckKey || holdingLeft || slideTime > 0);
    player.crouch += ((player.duck ? 1 : 0) - player.crouch) * (1 - Math.exp(-23*dt));
    const dx = player.lane*laneWidth - player.x;
    player.x += Math.sign(dx) * Math.min(Math.abs(dx), 9*dt);
    fillCourse();
    for (const e of entities) {
        if (e.done) continue;
        const gap = e.at - distance;
        const lateralGap = Math.abs(player.x-e.x);
        if (Math.abs(gap) < .36 && lateralGap < (e.kind === 'gem' ? .48 : .94)) {
            if (e.kind === 'gem') {
                if (player.y < 1.45 && !player.duck) {score += 10; e.done = true;}
            } else if (e.kind === 'gate' ? (player.crouch < .8 && player.y < 1.85) || lateralGap > .52 : player.y < .62) {
                state = 'catching';
                document.body.dataset.state = state;
                clearInput();
                player.velocity = Math.min(0,player.velocity);
                chase.closingSpeed = Math.min(speed + 1.5, chase.lead / .85);
                return;
            }
        }
        if (gap < -.36 && e.kind !== 'gem') { score++; e.done = true; }
    }
    entities = entities.filter(e => e.at > distance-7 && !(e.done && e.kind === 'gem'));
    el('score').textContent = score;
}
function advanceCapture(dt) {
    chase.stumble = Math.min(1,chase.stumble + 2.8*dt);
    player.velocity -= 16*dt;
    player.y = Math.max(0,player.y + player.velocity*dt);
    player.crouch += (1-player.crouch)*(1-Math.exp(-9*dt));
    const closed = Math.min(chase.lead,chase.closingSpeed*dt);
    chase.x += (player.x+.08-chase.x)*(closed/Math.max(.000001,chase.lead));
    chase.lead -= closed;
    chase.stride += closed;
    if(chase.lead === 0){
        chase.hold += dt;
        if(chase.hold >= 1.65) end();
    }
}
function frame(now) {
    const dt = Math.min((now-(lastFrame ?? now))/1000,.075);
    lastFrame = now;
    time += dt;
    if (state === 'playing') {
        const steps = Math.max(1,Math.ceil(dt*90));
        for(let i=0;i<steps && state==='playing';i++) advance(dt/steps);
    } else if(state==='catching') advanceCapture(dt);
    if(state==='playing'||state==='catching'){
        const metres = chase.lead > 0 ? Math.max(1,Math.round(chase.lead)) : 0;
        el('lead').textContent = metres+' m';
    }
    const menuVisible=state==='start'||state==='over';
    menuBlend += ((menuVisible?1:0)-menuBlend)*(1-Math.exp(-5*dt));
    draw(state, distance, player, entities, time, menuBlend, chase);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Offline mode unavailable', error));
}
