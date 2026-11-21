// Distances are measured along the trail. Each bend turns through a signed
// angle over a fixed arc length; lane offsets follow its local right vector.
export const courses = [
    {name:'Lagoon Coast', island:'Sāmoa', length:148, speed:0, fog:0xafdacc, water:0x39a7aa,
        stone:[0xbb9b6b,0xc3a77a,0xbba077,0xcfb68a], turns:[[29,24,54],[99,22,-63]],
        jumps:[56], cable:{at:71,end:93,lane:0}, obstacles:[[21,0,'barrier'],[42,-1,'gate'],[113,1,'gate'],[135,0,'barrier']]},
    {name:'Lava Ridge', island:'Hawaiʻi', length:174, speed:.8, fog:0xd4ad99, water:0x44363d,
        stone:[0x615455,0x766668,0x685a59,0x594e54], turns:[[18,26,-65],[54,19,48],[128,23,60]],
        jumps:[48,149], cable:{at:86,end:112,lane:1}, obstacles:[[24,1,'barrier'],[68,-1,'gate'],[124,0,'barrier'],[164,1,'gate']]},
    {name:'Fern Valley', island:'Aotearoa', length:196, speed:1.5, fog:0x9cbeb6, water:0x325851,
        stone:[0x74826d,0x768675,0x617865,0x849684], turns:[[15,20,58],[43,24,-76],[82,18,46],[154,22,-58]],
        jumps:[63,159], cable:{at:106,end:136,lane:-1}, obstacles:[[21,-1,'barrier'],[44,1,'gate'],[84,0,'barrier'],[146,1,'gate'],[182,-1,'barrier']]},
    {name:'Blowhole Cliffs', island:'Tonga', length:210, speed:1.7, fog:0xa7d4d4, water:0x217689,
        stone:[0xad9d8b,0xbfaf99,0xa59482,0xcdbca4], turns:[[22,24,-64],[53,18,44],[103,24,-54],[161,26,69]],
        jumps:[48,140,191], cable:{at:76,end:100,lane:1}, obstacles:[[24,-1,'gate'],[63,1,'barrier'],[118,0,'gate'],[164,-1,'barrier']]},
    {name:'Crater Grasslands', island:'Rapa Nui', length:226, speed:1.9, fog:0xc5c9a2, water:0x828147,
        stone:[0xa48261,0xad906c,0xb29a77,0x977957], turns:[[20,27,66],[69,24,-70],[101,23,46],[170,28,-68]],
        jumps:[56,118,207], cable:{at:138,end:165,lane:0}, obstacles:[[23,1,'barrier'],[42,-1,'gate'],[78,0,'barrier'],[98,-1,'gate'],[185,1,'gate']]},
    {name:'Waterfall Pass', island:'Tahiti', length:244, speed:2.1, fog:0xabc9be, water:0x2d555b,
        stone:[0x586262,0x65706b,0x525c5b,0x708078], turns:[[17,22,-56],[51,27,70],[122,20,-45],[159,19,58],[202,22,-66]],
        jumps:[60,149,211], cable:{at:88,end:119,lane:-1}, obstacles:[[24,0,'gate'],[40,1,'barrier'],[76,-1,'gate'],[134,1,'barrier'],[174,-1,'gate'],[194,0,'barrier'],[231,1,'gate']]}
];

export function trackPoint(course, distance, laneX=0) {
    let x=0, z=0, heading=0, previous=0;
    for(const [start,length,degrees] of course.turns){
        if(distance<=start)break;
        x+=Math.sin(heading)*(start-previous);
        z-=Math.cos(heading)*(start-previous);
        const curvature=degrees*Math.PI/(180*length);
        const end=Math.min(distance,start+length);
        const next=heading+curvature*(end-start);
        x+=(Math.cos(heading)-Math.cos(next))/curvature;
        z-=(Math.sin(next)-Math.sin(heading))/curvature;
        heading=next;previous=end;
    }
    return {x:x+Math.sin(heading)*(distance-previous)+Math.cos(heading)*laneX,
        z:z-Math.cos(heading)*(distance-previous)+Math.sin(heading)*laneX, heading};
}

export function cableHeight(cable, at) {
    const u=Math.max(0,Math.min(1,(at-cable.at)/(cable.end-cable.at)));
    return 3.05-.7*u-.38*Math.sin(Math.PI*u);
}

// Express the next course in the outgoing trail's coordinate system.
export function routePoint(course, distance, laneX=0) {
    if(distance<=course.length)return trackPoint(course,distance,laneX);
    const end=trackPoint(course,course.length);
    const next=courses[(courses.indexOf(course)+1)%courses.length];
    const p=trackPoint(next,distance-course.length,laneX);
    const cs=Math.cos(end.heading),sn=Math.sin(end.heading);
    return {x:end.x+cs*p.x-sn*p.z,z:end.z+sn*p.x+cs*p.z,heading:end.heading+p.heading};
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
    for(let at=cable.at+4;at<cable.end-1;at+=4)
        items.push({kind:'gem',at,x,height:cableHeight(cable,at)-.9,move:'ride'});
    return items.sort((a,b)=>a.at-b.at);
}
