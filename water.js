// Metres and seconds. Longer gravity waves travel faster than the short chop.
export const seaLevel = -.91;
export const swells = [
    {kx:.41, kz:.62, amplitude:.14, phase:0},
    {kx:-.83, kz:.33, amplitude:.075, phase:1.3},
    {kx:.36, kz:-1.42, amplitude:.035, phase:2.1}
].map(wave => ({...wave, omega:Math.sqrt(9.81*Math.hypot(wave.kx,wave.kz))}));

export function surfaceHeight(x,z,time) {
    let height=seaLevel;
    for(const {kx,kz,amplitude,omega,phase} of swells)
        height+=amplitude*Math.sin(kx*x+kz*z-omega*time+phase);
    return height;
}

// A short crown of spray leaves the contact point at impact, then falls under gravity.
const drops=Array.from({length:16},(_,i)=>{
    const angle=i*2.39996, speed=1.05+.24*(i%5);
    return {vx:Math.cos(angle)*speed,vz:Math.sin(angle)*speed,
        vy:2.65+.36*(i%6),radius:.044+.009*(i%3)};
});

export function forEachSplashDrop(splash,time,draw) {
    if(!splash)return;
    const age=time-splash.time;
    if(age<0 || age>1.4)return;
    for(const {vx,vz,vy,radius} of drops){
        const rise=age*(vy*splash.strength-4.905*age);
        if(rise>0)draw(splash.x+vx*age,splash.height+rise,splash.z+vz*age,radius);
    }
}
