// The feet follow the square landing. The shoulders lead the pivot and the
// chase camera finishes rotating a few strides later.
export function ease(value){
    const t=Math.max(0,Math.min(1,value));
    return t*t*(3-2*t);
}
export function cornerMotion(turn,metres,delay=0){
    if(!turn)return null;
    const travel=metres-turn[0], d=travel-delay, direction=turn[1];
    if(d<=-1.25 || d>=4.5)return null;
    const body=ease((d+.48)/3.3), camera=ease(d/4.5);
    const angle=direction*Math.PI/2;
    return {phase:(d+1.25)/5.75, direction,
        viewOffset:angle*(camera-(travel>0?1:0)), yaw:angle*(camera-body),
        correction:1-ease(d/3),
        plant:Math.sin(Math.PI*ease((d+1.25)/4.25)),
        lean:direction*Math.sin(Math.PI*ease((d+1.25)/5.75))};
}

// Rows describe pelvis height, forward pitch, side roll, shoulder reach,
// leading thigh, and knee bend. Times are fractions of the recovery.
const trip=[
    [0,.84,0,0,0,.1,.12], [.10,.69,-.48,.06,1.12,.76,.95],
    [.23,.27,-1.23,.34,1.50,.52,.9], [.32,.21,-1.36,.55,1.35,.21,.71],
    [.48,.23,-1.09,.48,.85,.22,.77], [.65,.36,-.68,.22,.53,1.32,1.76],
    [.78,.49,-.41,.09,.27,1.13,1.58], [1,.84,0,0,0,.1,.12]
];
const gate=[
    [0,.84,0,0,0,.1,.12], [.10,.71,.44,-.12,1.14,.78,1.26],
    [.25,.30,.72,-.47,1.25,1.38,1.39], [.39,.22,.55,-.84,.45,1.22,1.46],
    [.55,.27,-.12,-.56,.50,1.13,1.72], [.70,.37,-.55,-.22,.74,1.40,1.83],
    [.83,.54,-.30,-.06,.24,.93,1.25], [1,.84,0,0,0,.1,.12]
];
export function impactPose(kind,phase){
    const keys=kind==='gate'?gate:trip;
    let i=1;
    while(i<keys.length-1 && phase>keys[i][0])i++;
    const a=keys[i-1], b=keys[i], t=ease((phase-a[0])/(b[0]-a[0]));
    const sample=n=>a[n]+(b[n]-a[n])*t;
    return {height:sample(1),pitch:sample(2),roll:sample(3),reach:sample(4),
        thigh:sample(5),knee:sample(6),weight:ease(phase/.07)*(1-ease((phase-.79)/.21))};
}
