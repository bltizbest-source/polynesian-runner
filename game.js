import {tripStoneAt} from './cave.js';
import {createScene} from './scene.js';
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
const player = { x: 0, lane: 0, y: 0, velocity: 0, jumps: 0, duck: false, crouch: 0, fallen: 0, kneeling: 0 };
const startingLead = 5, hitPenalty = 10;
const cleanMetresPerLeadMetre = 16, recoverySeconds = 1.85;

// The sleeping ridgeback is just inside the entrance, beside the path.
const denAt = 2.4;
const chase = {lead:startingLead, x:1.06, stride:0, stumble:0, hold:0};
const gestures = new Map();
const tripTime = 2.8, flightTime = 5.65, introDuration = flightTime + 2;
const introLength = tripStoneAt + .35 + 8;

let slideTime = 0;
let duckKey = false;

function fillCourse() {
    while (nextObstacle < distance + 145) {
        const lane = obstacleCount === 0 ? 0 : Math.floor(Math.random()*3)-1;
        const kind = obstacleCount % 2 ? 'gate' : 'barrier';
        const x = lane * laneWidth;
        for (const offset of [-12, -8, -5]) {
            entities.push({kind:'gem', at:nextObstacle + offset, x, height:1.12, move:'run'});
        }
        const move = kind === 'gate' ? 'duck' : 'jump';
        const height = move === 'duck' ? .55 : 1.85;
        entities.push({kind:'gem', at:nextObstacle - 1.8, x, height, move});
        entities.push({kind, at:nextObstacle, x});
        entities.push({kind:'gem', at:nextObstacle + 1.8, x, height, move});
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
    state = 'intro';
    lastFrame = undefined;
    document.body.dataset.state = state;
    distance = score = obstacleCount = 0;
    entities = [];
    nextObstacle = 24;
    fillCourse();
    clearInput();
    Object.assign(player, {x:0, lane:0, y:0, velocity:0, jumps:0, crouch:0, fallen:0, kneeling:0});
    Object.assign(chase, {lead:-denAt, x:1.5, stride:0, stumble:0, hold:0, intro:0, wake:0, stone:0, runIn:0, hitTime:0});
    el('menu').hidden = true;
    el('live').hidden = el('lead-hud').hidden = state === 'intro';
    el('lead').textContent = startingLead + ' m';
    el('skip').hidden = false;
    el('skip').focus({preventScroll:true});
    el('hit').hidden = true;
    el('score').textContent = 0;
}
function finishIntro() {
    if (state !== 'intro') return;
    state = 'playing';
    document.body.dataset.state = state;
    chase.lead = startingLead;
    chase.runIn = introLength;
    chase.stride = introLength - denAt - startingLead;
    chase.x = .9;
    player.fallen = player.kneeling = 0;
    el('skip').hidden = true;
    el('live').hidden = el('lead-hud').hidden = false;
}
el('skip').addEventListener('click', finishIntro);
function end() {
    state = 'over';
    document.body.dataset.state = state;
    clearInput();
    if (score > best) {
        best = score;
        try { localStorage.setItem(storageKey, best); } catch {}
    }
    el('best').textContent = best;
    el('hit').hidden = true;
    el('live').hidden = true;
    el('lead-hud').hidden = true;
    el('title').textContent = 'Caught!';
    el('description').textContent = 'Score ' + score + '  ·  Distance ' + Math.floor(distance) + ' m';
    el('start-label').textContent = 'Run again';
    el('home').hidden = false;
    el('menu').hidden = false;
    el('start').focus({preventScroll:true});
}
function duckRequested() {
    if (duckKey || slideTime > 0) return true;
    for (const gesture of gestures.values()) {
        if (!gesture.used && gesture.x <= innerWidth / 2 && performance.now() - gesture.start > 100) return true;
    }
    return false;
}
function jump() {
    if (chase.hitTime > 0) return;
    if ((player.y > 0 || !duckRequested()) && player.jumps < 2) {
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
    Object.assign(player, {x:0, lane:0, y:0, crouch:0, fallen:0, kneeling:0});
    chase.stumble = chase.runIn = chase.hold = 0;
    el('title').innerHTML = 'Temple<br><em>Passage</em>';
    el('description').textContent = 'Chase the gold through ancient gates on an endless jungle run.';
    el('start-label').textContent = 'Start run';
    el('home').hidden = true;
    el('start').focus();
});
function changeLane(direction) {
    if (chase.hitTime > 0) return;
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

function easePhase(time, start, end) {
    const u = Math.max(0, Math.min(1, (time - start) / (end - start)));
    return u * u * (3 - 2 * u);
}

function advance(dt) {
    const lostTime = Math.min(dt, chase.hitTime);
    chase.hitTime = Math.max(0, chase.hitTime - dt);
    const sinceHit = recoverySeconds - chase.hitTime;
    const fall = easePhase(sinceHit, 0, .30);
    const pushUp = easePhase(sinceHit, .78, 1.25);
    const stand = easePhase(sinceHit, 1.30, recoverySeconds);
    player.fallen = fall * (1 - pushUp);
    player.kneeling = pushUp * (1 - stand);
    // Slide briefly on impact, stop on the ground, then accelerate off one knee.
    const speed = (8 + Math.min(distance / 160, 6)) * (1 - fall + stand);
    const previousMetres = Math.floor(distance);
    distance += dt * speed;
    score += Math.floor(distance) - previousMetres;
    // Both actors move in track metres. While the runner is down, spend the
    // 10 m penalty over the recovery, so the beast must run the intervening ground.
    const oldLead = chase.lead;
    chase.lead = Math.max(0, oldLead + speed * (dt-lostTime) / cleanMetresPerLeadMetre
        - hitPenalty * lostTime / recoverySeconds);
    chase.stride += speed * dt + oldLead - chase.lead;
    el('hit').hidden = chase.hitTime === 0;
    const targetX = player.x + .08 + Math.min(1, chase.lead / 7);
    chase.x += (targetX - chase.x)*(1-Math.exp(-5*dt));
    if (chase.lead === 0) {
        state = 'catching';
        document.body.dataset.state = state;
        clearInput();
        return;
    }
    player.y = Math.max(0, player.y + player.velocity*dt - 8*dt*dt);
    player.velocity = player.y ? player.velocity - 16*dt : 0;
    if (!player.y) player.jumps = 0;
    slideTime = Math.max(0, slideTime-dt);
    player.duck = chase.hitTime === 0 && player.y === 0 && duckRequested();
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
                if (chase.hitTime > 0) continue;
                const matchedMove = (e.move === 'jump' && player.y >= .65)
                    || (e.move === 'duck' && player.duck)
                    || (e.move === 'run' && player.y < .55 && !player.duck);
                if (matchedMove) {score += 10; e.done = true;}
            } else {
                const clearsObstacle = e.kind === 'gate'
                    ? player.y >= 1.85 || (player.crouch >= .8 && lateralGap <= .52)
                    : player.y >= .62;
                if (clearsObstacle) continue;
                e.done = true;
                e.struckAt = time;
                chase.hitTime = recoverySeconds;
                el('hit').hidden = false;
                player.velocity = Math.min(0, player.velocity);
                clearInput();
                player.lane = Math.round(player.x / laneWidth);
            }
        }
        if (gap < -.36 && e.kind !== 'gem') { score++; e.done = true; }
    }
    entities = entities.filter(e => e.kind === 'gem' ? !e.done && e.at >= distance-.36 : e.at > distance-7);
}
function advanceCapture(dt) {
    chase.stumble = Math.min(1,chase.stumble + 2.8*dt);
    player.velocity -= 16*dt;
    player.y = Math.max(0,player.y + player.velocity*dt);
    player.crouch += (1-player.crouch)*(1-Math.exp(-9*dt));
    player.fallen *= Math.exp(-4*dt);
    player.kneeling *= Math.exp(-4*dt);
    chase.hold += dt;
    if(chase.hold >= 1.65) end();
}
function frame(now) {
    const elapsed = (now - (lastFrame ?? now)) / 1000;
    const dt = Math.min(elapsed, .075);
    lastFrame = now;
    time += dt;
    if (state === 'intro') {
        chase.intro = Math.min(introDuration, chase.intro + elapsed);
        const t = chase.intro;
        const trip = easePhase(t, tripTime, tripTime+.40);
        const kneel = easePhase(t, 4.62, 5.14);
        const rise = easePhase(t, 5.17, flightTime);
        const flight = Math.max(0,(t-flightTime)/2);
        chase.runIn = Math.min(t/tripTime,1)*tripStoneAt + .35*trip + 8*flight*flight;
        player.fallen = trip*(1-kneel);
        player.kneeling = kneel*(1-rise);
        chase.stone = easePhase(t,tripTime,tripTime+.62);
        chase.wake = easePhase(t,tripTime+.53,4.45);
        chase.stride = (introLength - denAt - startingLead)*flight*flight;
        chase.lead = chase.runIn - denAt - chase.stride;
        chase.x = 1.5 - .6*flight;
        if (t === introDuration) finishIntro();
    } else if (state === 'playing') {
        const steps = Math.max(1,Math.ceil(dt*90));
        for(let i=0;i<steps && state==='playing';i++) advance(dt/steps);
    } else if(state==='catching') advanceCapture(dt);
    if(state==='playing'||state==='catching'){
        el('score').textContent = score;
        const metres = chase.lead > 0 ? Math.max(1,Math.round(chase.lead)) : 0;
        el('lead').textContent = metres+' m';
    }
    const menuVisible=state==='start'||state==='over';
    menuBlend += ((menuVisible?1:0)-menuBlend)*(1-Math.exp(-5*dt));
    const courseDistance = state === 'intro' ? chase.runIn - introLength : distance;
    draw(state, courseDistance, player, entities, time, menuBlend, chase);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Offline mode unavailable', error));
}
