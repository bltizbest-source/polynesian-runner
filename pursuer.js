import * as T from './vendor/three.module.min.js';

// An obsidian ridgeback with a heavy forequarter and a springing hind gait.
export function createPursuer(scene) {
    const hull=new T.SphereGeometry(1,14,10), fang=new T.ConeGeometry(1,1,7);
    const hide=new T.MeshStandardMaterial({color:0x392d38,roughness:.82});
    const plate=new T.MeshStandardMaterial({color:0x454257,roughness:.59});
    const ivory=new T.MeshStandardMaterial({color:0xe2bf85,roughness:.6});
    const ember=new T.MeshStandardMaterial({color:0xf58c44,emissive:0xbd3c0c,emissiveIntensity:.7});
    function pivot(parent,x=0,y=0,z=0) {
        const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;
    }
    function form(parent,shape,material,x,y,z,rx,ry,rz){
        const m=new T.Mesh(shape,material);m.position.set(x,y,z);m.scale.set(rx,ry,rz);
        m.castShadow=true;parent.add(m);return m;
    }
    const root=pivot(scene),body=pivot(root),head=pivot(body,0,.69,-.49);
    form(body,hull,hide,0,.58,0,.38,.33,.64);
    form(body,hull,plate,0,.73,-.27,.43,.36,.39);
    form(head,hull,hide,0,.045,-.11,.295,.24,.31);
    form(head,hull,plate,0,-.055,-.34,.23,.135,.22);
    for(const s of [-1,1]){
        form(head,hull,ember,s*.225,.09,-.31,.063,.038,.066);
        form(head,fang,ivory,s*.23,-.015,-.37,.066,.30,.063).rotation.z=-s*.38;
        form(head,fang,plate,s*.23,.235,.025,.095,.32,.10).rotation.z=-s*.66;
        form(head,fang,ivory,s*.24,.22,-.05,.062,.28,.065).rotation.x=.61;
    }
    for(let i=0;i<6;i++){
        const z=-.40+i*.168, height=.53-.051*i,base=1.13-.058*i;
        form(body,fang,ember,0,base,z,.089,height,.144).rotation.x=.50;
        form(body,fang,plate,0,base-.045,z+.045,.098,height*.83,.129).rotation.x=.50;
        for(const s of [-1,1]){
            const scute=form(body,hull,plate,s*(.248-i*.012),base-.21,z,.108,.054,.16);
            scute.rotation.z=-s*.58;
            form(body,fang,ivory,s*(.259-i*.012),base-.152,z+.025,.036,.14,.048).rotation.z=-s*.52;
        }
    }
    const tailBase=pivot(body,0,.58,.46);
    form(tailBase,hull,hide,0,.035,.22,.14,.125,.36);
    const tip=pivot(tailBase,0,.06,.41);
    form(tip,hull,plate,0,.07,.19,.076,.078,.285).rotation.x=-.3;
    const legs=[];
    for(const s of [-1,1])for(const rear of [false,true]){
        const hip=pivot(body,s*.287,rear?.53:.64,rear?.40:-.29);
        form(hip,hull,rear?hide:plate,0,-.122,0,.14,rear?.22:.26,.16);
        const ankle=pivot(hip,0,rear?-.26:-.33,.035);
        form(ankle,hull,hide,0,-.11,0,.084,.165,.089);
        form(ankle,hull,plate,0,-.205,-.057,.103,.069,.145);
        legs.push({hip,ankle,s,rear});
    }
    return function animate(state,player,t,chase) {
        root.visible=state!=='start';
        if(!root.visible)return;
        const gap=.80+chase.lead;
        root.position.set(chase.x,0,gap+chase.stumble*.48);
        root.rotation.y=Math.atan2(chase.x-player.x,gap)*.81;
        const run=chase.lead>0?1:0,phase=chase.stride*2.28;
        const lunge=state==='catching'?Math.sin(Math.PI*Math.max(0,1-chase.lead/.85)):0;
        const pinned=state==='over'||chase.lead===0;
        body.position.y=run*.081*Math.abs(Math.sin(phase))+.013*Math.sin(t*3)+lunge*.19;
        body.rotation.x=.09*Math.sin(phase)*run+lunge*.24-(pinned?.19:0);
        head.rotation.x=.1*Math.cos(phase+.5)*run-.07-(pinned?.24:0);
        tailBase.rotation.y=.34*Math.sin(t*4.1);tip.rotation.y=.37*Math.sin(t*4.1-.8);
        for(const {hip,ankle,s,rear} of legs){
            const swing=Math.sin(phase+(rear?2.9:0)+s*.51);
            hip.rotation.x=swing*.72*run;
            ankle.rotation.x=-.19-Math.max(0,swing)*.78*run;
        }
    };
}
