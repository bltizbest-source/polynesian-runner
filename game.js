import {courses,courseItems,cableHeight,openSpan,runnerPoint,trackPoint} from './courses.js';
import {surfaceHeight} from './water.js';
import {cornerMotion} from './motion.js';
import {tripStoneAt} from './cave.js';
import {createScene} from './scene.js?v=35';
const canvas = document.getElementById('world');
let draw;
function useCanvasRenderer() {
    const fallback = canvas.cloneNode();
    canvas.replaceWith(fallback);
    draw = createScene(fallback, 1.55);
}
const el = id => document.getElementById(id);
const storageKey = 'polynesianRunnerHighScore';
let best = 0;
function syncBest(candidate = 0) {
    best = Math.max(best, candidate);
    try {
        const value = Number(localStorage.getItem(storageKey));
        const saved = Number.isSafeInteger(value) && value >= 0 ? value : 0;
        if (best > saved) localStorage.setItem(storageKey, String(best));
        else best = saved;
        el('best-label').textContent = 'Best';
    } catch {
        el('best-label').textContent = 'Best (this session)';
    }
    el('best').textContent = best;
}
syncBest();
window.addEventListener('storage', event => { if (event.key === storageKey) syncBest(); });
window.addEventListener('pageshow', () => syncBest());
window.addEventListener('pagehide', () => syncBest());

let state = 'start', distance = 0, score = 0, level = 0;
let entities=[], upcoming=[], startingLevel=0, time=0, menuBlend=1;
let turnIndex=0, turnQueued=false, fallTime=0, failureSpeed=0;
const turnWindow=11;
const laneWidth = 1.55;
const player = { x: 0, lane: 0, y: 0, velocity: 0, jumps: 0, duck: false, crouch: 0, fallen: 0, kneeling: 0 };
const startingLead = 5, hitPenalty = 10;
const cleanMetresPerLeadMetre = 16, recoverySeconds = 1.85;

// The sleeping ridgeback is just inside the entrance, beside the path.
const denAt = 2.4;
const chase = {lead:startingLead, x:1.06, stride:0, stumble:0, hold:0, completedDistance:0};
const gestures = new Map();
const tripTime = 2.8, flightTime = 5.65, introDuration = flightTime + 2;
const introLength = tripStoneAt + .35 + 8;

let slideTime = 0;
let duckKey = false;

const picker=el('level-select');
for(const [i,course] of courses.entries())picker.add(new Option((i+1)+' · '+course.island+' — '+course.name,i));
function selectLevel(index){
    level=index;picker.value=String(index);
    turnIndex=0;turnQueued=false;
    player.corner=null;player.pivot=null;player.cornerShift=null;
    const course=courses[level], next=courses[(level+1)%courses.length];
    entities=courseItems(course);
    upcoming=courseItems(next).map(item=>({...item,at:item.at+course.length}));
    el('course-name').textContent=courses[level].island+' · '+courses[level].name;
}
selectLevel(0);
picker.addEventListener('change',()=>selectLevel(Number(picker.value)));

function clearInput() {
    duckKey = false;
    gestures.clear();
    slideTime = 0;
    player.duck = false;
}
function start() {
    if (!draw || (state !== 'start' && state !== 'over')) return;
    if(state==='start')startingLevel=level;
    selectLevel(startingLevel);
    state = level===0 ? 'intro' : 'playing';
    lastFrame = undefined;
    document.body.dataset.state = state;
    distance=score=0;
    player.riding=false;
    clearInput();
    Object.assign(player, {x:0, lane:0, laneVelocity:0, y:0, velocity:0, jumps:0, crouch:0, fallen:0, kneeling:0,impact:null,drop:null,grip:0});
    Object.assign(chase, {lead:-denAt, x:1.5, stride:0, stumble:0, hold:0, intro:0, wake:0, stone:0, runIn:0, hitTime:0, completedDistance:0, missedTurn:null, failure:''});
    el('menu').hidden = true;
    el('live').hidden = el('lead-hud').hidden = state === 'intro';
    el('lead').textContent = startingLead + ' m';
    el('level-choice').hidden=true;
    el('route-hud').hidden=state==='intro';
    el('skip').hidden = state!=='intro';
    if(state==='playing')chase.lead=startingLead;
    if(state==='intro')el('skip').focus({preventScroll:true});
    el('hit').hidden = true;
    el('score').textContent = 0;
}
function finishIntro() {
    if (state !== 'intro') return;
    state = 'playing';
    document.body.dataset.state = state;
    el('route-hud').hidden=false;
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
    player.riding=false;
    el('route-hud').hidden=true;
    state = 'over';
    document.body.dataset.state = state;
    clearInput();
    el('hit').hidden = true;
    el('live').hidden = true;
    el('lead-hud').hidden = true;
    el('title').textContent = chase.failure || 'Caught!';
    el('description').textContent = 'Score ' + score + '  ·  Distance ' + Math.floor(chase.completedDistance+(chase.failure?chase.failureAt:distance)) + ' m';
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
    if (chase.hitTime > 0 || player.riding) return;
    if ((player.y > 0 || !duckRequested()) && player.jumps < 2) {
        player.velocity = 6.2;
        player.jumps++;
    }
}
el('start').addEventListener('click', start);
el('home').addEventListener('click', () => {
    state = 'start';
    document.body.dataset.state = state;
    distance=chase.completedDistance=0;
    chase.missedTurn=null;chase.failure='';
    selectLevel(level);
    el('level-choice').hidden=false;
    Object.assign(player, {x:0, lane:0, laneVelocity:0,y:0, crouch:0, fallen:0, kneeling:0,impact:null,drop:null,grip:0});
    chase.stumble = chase.runIn = chase.hold = 0;
    el('title').innerHTML = 'Temple<br><em>Passage</em>';
    el('description').textContent = 'Swipe at corners, jump the broken trail and catch ziplines across six islands.';
    el('start-label').textContent = 'Start run';
    el('home').hidden = true;
    el('start').focus();
});
function promptedTurn(){
    const turn=courses[level].turns[turnIndex];
    return turn && distance>=turn[0]-turnWindow ? turn : null;
}
function steer(direction) {
    const turn=promptedTurn();
    if(turn && !turnQueued){
        turnQueued=direction===turn[1];
        if(turnQueued){
            player.corner=turn;player.cornerShift=null;
            if(chase.missedTurn!==null){
                const straight=runnerPoint(courses[level],distance,turn[0],player.x);
                const onTrail=trackPoint(courses[level],distance,player.x);
                player.cornerShift={delay:distance-turn[0],
                    x:straight.x+Math.cos(straight.heading)*player.x-onTrail.x,
                    z:straight.z+Math.sin(straight.heading)*player.x-onTrail.z};
                chase.missedTurn=null;
            }
        }
        return;
    }
    if (chase.hitTime > 0 || player.riding) return;
    player.lane = Math.max(-1, Math.min(1, player.lane + direction));
}
document.addEventListener('keydown', e => {
    if (e.target===picker || el('guide').open || (e.code === 'Space' && e.target.closest('button'))) return;
    if (!['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) return;
    e.preventDefault();
    if (e.repeat) return;
    if (state !== 'playing') {
        if (e.code === 'Space') start();
    } else if (e.code === 'ArrowDown') duckKey = true;
    else if (e.code === 'ArrowLeft') steer(-1);
    else if (e.code === 'ArrowRight') steer(1);
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
    if (Math.abs(dx) > Math.abs(dy)) steer(Math.sign(dx));
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

function leaveTrail(reason,speed,missedTurn=null){
    chase.failure=reason;chase.missedTurn=missedTurn;
    chase.failureAt=distance;failureSpeed=Math.max(7,speed);fallTime=0;
    state='falling';document.body.dataset.state=state;
    clearInput();player.riding=false;player.impact=null;
    player.drop={kind:missedTurn!==null?'corner':openSpan(courses[level],distance),
        direction:missedTurn!==null?courses[level].turns[turnIndex][1]:1,phase:0};
    el('route-hud').textContent=reason;
}
function advanceFall(dt){
    const runningOut=chase.missedTurn!==null && !fallTime;
    distance+=failureSpeed*dt*(runningOut?1:.50*Math.exp(-3*fallTime));
    const course=courses[level];
    if(runningOut){
        const runner=runnerPoint(course,distance,chase.missedTurn,player.x), road=trackPoint(course,distance);
        const dx=runner.x+Math.cos(runner.heading)*player.x-road.x;
        const dz=runner.z+Math.sin(runner.heading)*player.x-road.z;
        if(Math.abs(dx*Math.cos(road.heading)+dz*Math.sin(road.heading))<2.55)return;
    }
    fallTime+=dt;
    player.drop.phase=Math.min(1,fallTime/.94);
    const point=runnerPoint(course,distance,chase.missedTurn,player.x);
    const x=point.x+Math.cos(point.heading)*player.x, z=point.z+Math.sin(point.heading)*player.x;
    const surface=surfaceHeight(x,z,time);
    if(player.drop.splash){
        // Buoyancy and drag settle the runner with the shoulders above water.
        player.velocity+=((surface-.93-player.y)*22-player.velocity*7)*dt;
    }else{
        player.velocity-=12*dt;
    }
    player.y+=player.velocity*dt;
    if(!player.drop.splash && player.y<=surface && player.velocity<0){
        player.drop.splash={x,z,time,height:surface,strength:Math.min(1.4,Math.abs(player.velocity)/4.5)};
        player.velocity*=.48;
    }
    if(player.drop.splash && time-player.drop.splash.time>=.72)end();
}

function advance(dt) {
    const lostTime = Math.min(dt, chase.hitTime);
    chase.hitTime = Math.max(0, chase.hitTime - dt);
    const sinceHit = recoverySeconds - chase.hitTime;
    const fall = easePhase(sinceHit, 0, .30);
    const stand = easePhase(sinceHit, 1.30, recoverySeconds);
    if(player.impact){
        player.impact.phase=sinceHit/recoverySeconds;
        if(chase.hitTime===0)player.impact=null;
    }
    // Slide briefly on impact, stop on the ground, then accelerate off one knee.
    const course=courses[level], cable=course.cable;
    let pace=8+course.speed+distance/160;
    if(chase.completedDistance && distance<16){
        const previous=courses[(level+courses.length-1)%courses.length];
        const entryPace=8+previous.speed+previous.length/160;
        pace=entryPace+(pace-entryPace)*easePhase(distance,0,16);
    }
    const slide=player.impact?.kind==='gate'?0:.19;
    const impactPace=1-fall+slide*fall*(1-easePhase(sinceHit,.30,.72))+stand;
    const speed = pace * impactPace * (player.riding?1.18:1);
    const previousMetres = Math.floor(distance);
    distance += dt * speed;
    player.pivot=cornerMotion(player.corner,distance,player.cornerShift?.delay);
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
    // Critically damped so a second swipe can redirect the runner mid-step.
    const targetLane=player.lane*laneWidth, offset=player.x-targetLane;
    const spring=26, decay=Math.exp(-spring*dt), slope=player.laneVelocity+spring*offset;
    player.x=targetLane+(offset+slope*dt)*decay;
    player.laneVelocity=(player.laneVelocity-spring*slope*dt)*decay;
    if(!player.riding && chase.hitTime===0 && Math.abs(distance-cable.at)<.65 &&
        Math.abs(player.x-cable.lane*laneWidth)<.50 && player.y>.48){
        player.riding=true;player.lane=cable.lane;
        player.grabHeight=player.y;player.grabTime=0;
    }
    if(player.riding){
        player.grabTime+=dt;
        player.y=player.grabHeight+(cableHeight(cable,distance)-1.9-player.grabHeight)*easePhase(player.grabTime,0,.14);
        player.velocity=0;
        if(distance>=cable.end){player.riding=false;player.jumps=2;}
    }
    player.grip+=((player.riding?1:0)-player.grip)*(1-Math.exp(-20*dt));
    const turn=course.turns[turnIndex];
    if(turn && distance>=turn[0]){
        if(turnQueued){turnIndex++;turnQueued=false;}
        else{
            // A swipe just past the center can still plant on the landing.
            chase.missedTurn=turn[0];
            if(distance-turn[0]>.95){leaveTrail('Missed the turn',speed,turn[0]);return;}
        }
    }
    const span=openSpan(course,distance);
    if(span && !player.riding && player.y<=0){
        leaveTrail(span==='zipline'?'Missed the zipline':'Missed the jump',speed);
        return;
    }
    for (const e of entities) {
        if (e.done) continue;
        const gap = e.at - distance;
        const lateralGap = Math.abs(player.x-e.x);
        if (Math.abs(gap) < .36 && (e.kind==='hurdle' || lateralGap < (e.kind === 'gem' ? .48 : .94))) {
            if (e.kind === 'gem') {
                if (chase.hitTime > 0) continue;
                const matchedMove = (e.move==='ride' && player.riding) || (e.move === 'jump' && player.y >= .65)
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
                player.impact={kind:e.kind==='gate'?'gate':'trip',phase:0};
                el('hit').hidden = false;
                player.velocity = Math.min(0, player.velocity);
                clearInput();
                player.lane = Math.round(player.x / laneWidth);
            }
        }
        if (gap < -.36 && e.kind !== 'gem') { score++; e.done = true; }
    }
    if(distance>=course.length){
        distance-=course.length;
        chase.completedDistance+=course.length;
        selectLevel((level+1)%courses.length);
        return;
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
    if(player.impact){
        player.impact.phase=Math.min(1,player.impact.phase+dt*1.5);
        if(player.impact.phase===1)player.impact=null;
    }
    chase.hold += dt;
    if(chase.hold >= 1.65) end();
}
function frame(now) {
    const elapsed = Math.max(0, now - (lastFrame ?? now)) / 1000;
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
        if (score > best) syncBest(score);
    } else if(state==='catching') advanceCapture(dt);
    else if(state==='falling') advanceFall(dt);
    if(state==='playing'||state==='catching'){
        const c=courses[level], ahead=c.cable.at-distance;
        const next=courses[(level+1)%courses.length];
        const jumpAhead=c.jumps.some(at=>at>distance && at-distance<13);
        const turn=promptedTurn();
        const gapAhead=c.gaps.some(at=>at-1.5>distance && at-1.5-distance<10);
        el('route-hud').textContent=turn ? (turnQueued?'Turning ':'Turn ')+(turn[1]>0?'right →':'left ←')
            :player.riding?'Riding zipline':gapAhead?'Broken trail · jump':ahead>0 && ahead<15
            ? 'Zipline · '+['left','centre','right'][c.cable.lane+1]+' lane · jump'
            :jumpAhead?'Fallen log · jump':distance<16?'Level '+(level+1)+' · '+c.island+' · '+c.name
            :c.length-distance<10?'Ahead · '+next.island+' · '+next.name:c.name+' · '+Math.ceil(c.length-distance)+' m to arch';
        el('score').textContent = score;
        const metres = chase.lead > 0 ? Math.max(1,Math.round(chase.lead)) : 0;
        el('lead').textContent = metres+' m';
    }
    const menuVisible=state==='start'||state==='over';
    menuBlend += ((menuVisible?1:0)-menuBlend)*(1-Math.exp(-5*dt));
    const courseDistance = state === 'intro' ? chase.runIn - introLength : distance;
    const visibleItems=distance>courses[level].length-58 ? entities.concat(upcoming.filter(e=>e.at-distance<65)) : entities;
    draw(state, courseDistance, player, visibleItems, time, menuBlend, chase, courses[level]);
    requestAnimationFrame(frame);
}
export async function initializeGame() {
    try {
        const {createTempleScene} = await import('./temple.js?v=35');
        draw = createTempleScene(canvas);
        frame(performance.now());
        canvas.addEventListener('webglcontextlost', useCanvasRenderer, {once:true});
    } catch (error) {
        console.warn('Using the canvas renderer', error);
        useCanvasRenderer();
        frame(performance.now());
    }
    el('level-choice').hidden = false;
    el('start-label').textContent = 'Start run';
    el('start').disabled = false;
}
