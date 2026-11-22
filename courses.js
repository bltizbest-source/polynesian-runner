// Each turn is [distance along the centerline, quarter-turn direction].
export const courses = [
    {name:'Lagoon Coast', island:'Sāmoa', length:148, speed:0, fog:0xafdacc, water:0x39a7aa,
        stone:[0xbb9b6b,0xc3a77a,0xbba077,0xcfb68a], turns:[[36,1],[109,-1]],
        gaps:[14,62,132], jumps:[49], cable:{at:71,end:93,lane:0}, obstacles:[[24,0,'barrier'],[122,-1,'gate'],[143,1,'barrier']]},
    {name:'Lava Ridge', island:'Hawaiʻi', length:174, speed:.8, fog:0xd4ad99, water:0x44363d,
        stone:[0x615455,0x766668,0x685a59,0x594e54], turns:[[38,-1],[128,1]],
        gaps:[17,67,153], jumps:[54,141], cable:{at:86,end:112,lane:1}, obstacles:[[27,1,'barrier'],[77,-1,'gate'],[165,0,'barrier']]},
    {name:'Fern Valley', island:'Aotearoa', length:196, speed:1.5, fog:0x9cbeb6, water:0x325851,
        stone:[0x74826d,0x768675,0x617865,0x849684], turns:[[38,1],[88,-1],[166,1]],
        gaps:[16,74,148,184], jumps:[58], cable:{at:106,end:136,lane:-1}, obstacles:[[27,-1,'gate'],[140,1,'barrier'],[194,0,'gate']]},
    {name:'Blowhole Cliffs', island:'Tonga', length:210, speed:1.7, fog:0xa7d4d4, water:0x217689,
        stone:[0xad9d8b,0xbfaf99,0xa59482,0xcdbca4], turns:[[36,-1],[117,1],[167,-1]],
        gaps:[15,60,143,195], jumps:[130,182], cable:{at:76,end:100,lane:1}, obstacles:[[24,0,'barrier'],[68,-1,'gate'],[155,1,'gate']]},
    {name:'Crater Grasslands', island:'Rapa Nui', length:226, speed:1.9, fog:0xc5c9a2, water:0x828147,
        stone:[0xa48261,0xad906c,0xb29a77,0x977957], turns:[[39,1],[92,-1],[180,1]],
        gaps:[16,70,122,201], jumps:[55,106,215], cable:{at:138,end:165,lane:0}, obstacles:[[27,1,'barrier'],[80,-1,'gate'],[191,0,'barrier']]},
    {name:'Waterfall Pass', island:'Tahiti', length:244, speed:2.1, fog:0xabc9be, water:0x2d555b,
        stone:[0x586262,0x65706b,0x525c5b,0x708078], turns:[[39,-1],[132,1],[169,-1],[214,1]],
        gaps:[16,71,145,198,233], jumps:[57,184], cable:{at:88,end:119,lane:-1}, obstacles:[[27,-1,'gate'],[80,1,'barrier'],[156,0,'gate'],[225,1,'barrier']]}
];

export function trackPoint(course, distance, laneX=0) {
    let x=0, z=0, heading=0, previous=0;
    // Offset lanes meet on the diagonal of the square junction. This keeps
    // each lane continuous through its own right-angle pivot.
    const halfWidth=2.75;
    let shear=0;
    for(const [at,direction] of course.turns){
        const delta=distance-at;
        if(Math.abs(delta)<halfWidth)
            shear=direction*(delta<=0?-1:1)*(1-Math.abs(delta)/halfWidth);
        if(delta<=0)break;
        x+=Math.sin(heading)*(at-previous);
        z-=Math.cos(heading)*(at-previous);
        heading+=direction*Math.PI/2;
        previous=at;
    }
    const forward=distance-previous+laneX*shear;
    return {x:x+Math.sin(heading)*forward+Math.cos(heading)*laneX,
        z:z-Math.cos(heading)*forward+Math.sin(heading)*laneX,heading,shear};
}

export function cableHeight(cable, at) {
    const u=Math.max(0,Math.min(1,(at-cable.at)/(cable.end-cable.at)));
    return 3.05-.7*u-.38*Math.sin(Math.PI*u);
}

export function openSpan(course, at) {
    if(at>=course.cable.at+1.5 && at<course.cable.end-1.5)return 'zipline';
    return course.gaps.some(center=>at>=center-1.5 && at<center+1.5) ? 'gap' : null;
}

// The scenery follows the trail. A runner who misses a bend keeps the
// incoming heading and runs off the outside edge instead.
export function runnerPoint(course, distance, missedTurn, laneX=0) {
    const p=trackPoint(course,missedTurn ?? distance);
    const travel=(missedTurn==null?0:distance-missedTurn)+laneX*p.shear;
    p.x+=Math.sin(p.heading)*travel;
    p.z-=Math.cos(p.heading)*travel;
    return p;
}

// Orbit the camera about the athlete, including in either outside lane.
export function viewPoint(course,distance,chase,player){
    const p=runnerPoint(course,distance,chase.missedTurn,player.x);
    if(player.pivot){
        const angle=p.heading+player.pivot.viewOffset;
        p.x+=player.x*(Math.cos(p.heading)-Math.cos(angle));
        p.z+=player.x*(Math.sin(p.heading)-Math.sin(angle));
        p.heading=angle;
        if(player.cornerShift){
            p.x+=player.cornerShift.x*player.pivot.correction;
            p.z+=player.cornerShift.z*player.pivot.correction;
        }
    }
    return p;
}

// Express the next course in the outgoing trail's coordinate system.
export function routePoint(course, distance, laneX=0) {
    if(distance<=course.length)return trackPoint(course,distance,laneX);
    const end=trackPoint(course,course.length);
    const next=courses[(courses.indexOf(course)+1)%courses.length];
    const p=trackPoint(next,distance-course.length,laneX);
    const cs=Math.cos(end.heading),sn=Math.sin(end.heading);
    return {x:end.x+cs*p.x-sn*p.z,z:end.z+sn*p.x+cs*p.z,heading:end.heading+p.heading,shear:p.shear};
}

export function courseItems(course){
    const items=[];
    for(const [at,lane,kind] of [...course.obstacles,...course.jumps.map(at=>[at,0,'hurdle'])]){
        const x=lane*1.55, move=kind==='gate'?'duck':'jump';
        for(const offset of [-9,-5])items.push({kind:'gem',at:at+offset,x,height:1.12,move:'run'});
        items.push({kind,at,x});
        for(const offset of [-1.8,1.8])items.push({kind:'gem',at:at+offset,x,height:move==='duck'?.55:1.85,move});
    }
    const {cable}=course, x=cable.lane*1.55;
    for(const at of course.gaps){
        items.push({kind:'gem',at:at-6,x:0,height:1.12,move:'run'});
        for(const offset of [-1,1])items.push({kind:'gem',at:at+offset,x:0,height:1.92,move:'jump'});
        items.push({kind:'gem',at:at+4.5,x:0,height:1.12,move:'run'});
    }
    for(const [start] of course.turns){
        for(const offset of [-2,2,6])items.push({kind:'gem',at:start+offset,x:0,height:1.12,move:'run'});
    }
    for(const offset of [-9,-5])items.push({kind:'gem',at:cable.at+offset,x,height:1.12,move:'run'});
    items.push({kind:'gem',at:cable.at,x,height:1.95,move:'jump'});
    for(let at=cable.at+4;at<cable.end-1;at+=4)
        items.push({kind:'gem',at,x,height:cableHeight(cable,at)-.9,move:'ride'});
    // Keep approach markers clear of hazards and of the airborne gem arcs.
    const placed=items.filter(e=>e.kind!=='gem' || e.move!=='run');
    for(const e of items.filter(e=>e.kind==='gem' && e.move==='run')){
        if(!openSpan(course,e.at) && !placed.some(other=>Math.abs(other.at-e.at)<1.6 &&
            (other.x===e.x || other.kind==='hurdle')))placed.push(e);
    }
    return placed.sort((a,b)=>a.at-b.at);
}
