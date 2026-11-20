import * as T from './vendor/three.module.min.js';

// An obsidian ridgeback with a heavy forequarter and a springing hind gait.
export function createPursuer(scene) {
    const hull=new T.SphereGeometry(1,14,10), fang=new T.ConeGeometry(1,1,7);
    const hide=new T.MeshStandardMaterial({color:0x271e2b,roughness:.82});
    const plate=new T.MeshStandardMaterial({color:0x494254,roughness:.48});
    const mouth=new T.MeshStandardMaterial({color:0x210f1b});
    const skull=new T.MeshStandardMaterial({color:0x957e73,roughness:.62});
    const ivory=new T.MeshStandardMaterial({color:0xe2bf85,roughness:.6});
    const ember=new T.MeshStandardMaterial({color:0xf58c44,emissive:0xbd3c0c,emissiveIntensity:.7});
    function pivot(parent,x=0,y=0,z=0) {
        const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;
    }
    function form(parent,shape,material,x,y,z,rx,ry,rz){
        const m=new T.Mesh(shape,material);m.position.set(x,y,z);m.scale.set(rx,ry,rz);
        m.castShadow=true;parent.add(m);return m;
    }
    // Taper along a curved centreline so the hooks have sharp, swept tips.
    function hook(parent,mat,start,mid,end,radius){
        const curve=new T.QuadraticBezierCurve3(...[start,mid,end].map(p=>new T.Vector3(...p)));
        const g=new T.TubeGeometry(curve,8,radius,7,false);
        const pos=g.attributes.position,v=new T.Vector3();
        for(let row=0;row<=8;row++){
            const u=row/8,center=curve.getPointAt(u);
            for(let j=0;j<=7;j++){
                const i=row*8+j;
                v.fromBufferAttribute(pos,i).sub(center).multiplyScalar(1-u*.993).add(center);
                pos.setXYZ(i,v.x,v.y,v.z);
            }
        }
        g.computeVertexNormals();form(parent,g,mat,0,0,0,1,1,1);
    }
    const root=pivot(scene),body=pivot(root),head=pivot(body,0,.69,-.49);
    form(body,hull,hide,0,.58,0,.38,.33,.64);
    form(body,hull,plate,0,.73,-.27,.43,.36,.39);
    form(head,hull,hide,0,.09,-.12,.33,.25,.32);
    form(head,hull,skull,0,.085,-.37,.218,.115,.33);
    form(head,hull,hide,0,.047,-.59,.172,.085,.12);
    const jaw=pivot(head,0,-.01,-.17);
    form(jaw,hull,plate,0,-.095,-.20,.193,.089,.29);
    form(jaw,hull,mouth,0,-.039,-.21,.172,.041,.268);
    const bite=pivot(head,0,-.038,-.49);
    const bitePosition=new T.Vector3();
    const eyes=[];
    for(const s of [-1,1]){
        form(head,hull,mouth,s*.236,.143,-.31,.095,.077,.112);
        const eye=form(head,hull,ember,s*.26,.159,-.342,.077,.034,.089);
        eye.rotation.z=s*.29; eyes.push(eye);
        form(head,hull,mouth,s*.31,.16,-.38,.009,.026,.011);
        form(head,hull,skull,s*.226,.217,-.303,.119,.054,.147).rotation.z=s*.34;
        form(head,hull,mouth,s*.083,.092,-.674,.04,.027,.027);
        hook(head,skull,[s*.20,.23,-.08],[s*.57,.30,.14],[s*.48,.64,.40],.112);
        hook(head,plate,[s*.27,.05,-.15],[s*.47,.04,-.02],[s*.52,.17,.20],.091);
        hook(head,ivory,[s*.151,.032,-.51],[s*.18,-.14,-.55],[s*.17,-.207,-.48],.045);
        for(let j=0;j<4;j++){
            form(head,fang,ivory,s*.162,.005,-.30-j*.066,.027,.10,.029).rotation.x=Math.PI;
            form(jaw,fang,ivory,s*.15,-.018,-.12-j*.063,.026,.082,.029);
        }
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
        for(let i=-1;i<=1;i++)hook(ankle,ivory,[i*.048,-.20,-.124],[i*.052,-.188,-.21],[i*.054,-.25,-.23],.027);
        legs.push({hip,ankle,s,rear});
    }
    return function animate(state,player,t,chase) {
        root.visible=state!=='start' && (state==='intro' || chase.lead<14);
        if(!root.visible)return;
        const grip=T.MathUtils.smoothstep(chase.hold,0,.22);
        const hoist=T.MathUtils.smoothstep(chase.hold,.22,.91);
        const gap=.80+chase.lead;
        root.position.set(chase.x,0,gap+chase.stumble*.48+hoist*.58);
        root.rotation.y=Math.atan2(chase.x-player.x,gap)*.81;
        const opening=state==='intro', awake=opening?chase.wake:1;
        const run=opening ? T.MathUtils.smoothstep(chase.intro,5.65,6.25) : Number(chase.lead>0);
        root.rotation.y=T.MathUtils.lerp(.58,root.rotation.y,awake);
        body.scale.y=.84+.16*awake;
        for(const eye of eyes) eye.scale.y=.034*awake;
        const phase=chase.stride*2.28;
        const lunge=state==='catching'?Math.sin(Math.PI*Math.max(0,1-chase.lead/.85)):0;
        const pinned=state==='over'||chase.lead===0;
        body.position.y=-.19*(1-awake)+run*.081*Math.abs(Math.sin(phase))+.013*Math.sin(t*3)+lunge*.19;
        body.rotation.x=.09*Math.sin(phase)*run+lunge*.24-(pinned?.19:0)+hoist*.36;
        head.rotation.x=.1*Math.cos(phase+.5)*run-.07-(pinned?.24:0)+hoist*.63;
        head.rotation.z=hoist*(.13+.075*Math.sin(t*6));
        jaw.rotation.x=-(.21+.09*Math.sin(phase)+lunge*.51)*(1-grip)-.055*grip;
        if(opening){
            head.rotation.x+=.66*(1-awake)-.24*awake*(1-run);
            jaw.rotation.x*=awake;
            const snap=Math.sin(Math.PI*T.MathUtils.smoothstep(chase.intro,3.5,5.65));
            jaw.rotation.x-=.57*snap;
            head.rotation.x-=.14*snap;
        }
        tailBase.rotation.y=.74*(1-awake)+awake*.34*Math.sin(t*4.1);tip.rotation.y=.60*(1-awake)+awake*.37*Math.sin(t*4.1-.8);
        for(const {hip,ankle,s,rear} of legs){
            const swing=Math.sin(phase+(rear?2.9:0)+s*.51);
            hip.rotation.x=swing*.72*run+(rear?-.72:.68)*(1-awake);
            ankle.rotation.x=-.19-Math.max(0,swing)*.78*run;
        }
        return grip>0 ? bite.getWorldPosition(bitePosition) : null;
    };
}
