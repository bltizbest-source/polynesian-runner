import * as T from './vendor/three.module.min.js';

// The character faces -Z. Profiles describe elliptical cross-sections in metres.
export function createRunner(scene) {
    const root = new T.Group();
    scene.add(root);
    const skin = 0xab6546, hair = 0x241e20, cloth = 0x166357, band = 0xd39651;
    const sphere = new T.SphereGeometry(1, 18, 14);
    const materials = new Map();
    function material(color) {
        if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({color, roughness:.76}));
        return materials.get(color);
    }
    function joint(parent,x=0,y=0,z=0) {
        const node = new T.Group();
        node.position.set(x,y,z); parent.add(node); return node;
    }
    function mesh(parent,geometry,color) {
        const obj = new T.Mesh(geometry,material(color));
        obj.castShadow = true; parent.add(obj); return obj;
    }
    function oval(parent,color,x,y,z,rx,ry,rz) {
        const obj = mesh(parent,sphere,color);
        obj.position.set(x,y,z); obj.scale.set(rx,ry,rz); return obj;
    }
    function profile(rows) {
        const positions=[],indices=[],uv=[];
        const sides=28;
        for (const [i,[y,rx,rz,cz=0]] of rows.entries()) {
            for (let j=0;j<sides;j++) {
                const a=j*2*Math.PI/sides;
                positions.push(rx*Math.cos(a),y,cz+rz*Math.sin(a));
                uv.push(j/sides,i/(rows.length-1));
                if(i>0){
                    const b=(i-1)*sides+j, next=(i-1)*sides+(j+1)%sides;
                    indices.push(b,b+sides,next,next,b+sides,next+sides);
                }
            }
        }
        const g=new T.BufferGeometry();
        g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
        g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
        g.setIndex(indices);g.computeVertexNormals();return g;
    }
    // One continuous skin surface bends across each elbow or knee.
    function limb(parent,x,y,upper,rows,shorts=false) {
        const anchor=joint(parent,x,y);
        const g=profile(rows),weights=[],indices=[];
        for(let i=0;i<g.attributes.position.count;i++){
            const depth=-g.attributes.position.getY(i);
            const w=T.MathUtils.smoothstep(depth,upper-.065,upper+.065);
            indices.push(0,1,0,0);weights.push(1-w,w,0,0);
        }
        g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));
        g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
        let surfaceMaterials=material(skin);
        if(shorts){
            const split=rows.findIndex(([height])=>height>=-.365)*28*6;
            g.addGroup(0,split,0);g.addGroup(split,g.index.count-split,1);
            surfaceMaterials=[material(skin),material(0x244943)];
        }
        const surface=new T.SkinnedMesh(g,surfaceMaterials);
        const top=new T.Bone(),bend=new T.Bone();
        bend.position.y=-upper;top.add(bend);surface.add(top);
        surface.bind(new T.Skeleton([top,bend]));
        surface.frustumCulled=false;surface.castShadow=true;anchor.add(surface);
        return {anchor,bend};
    }
    const hips=joint(root),spine=joint(hips),neck=joint(spine,0,.61,-.018);
    // Wraparound woven panels share a small local texture. The larger bands
    // stay legible from the chase camera; the fine fibre shows in the menu.
    function weave(base, reed, trim) {
        const tile=document.createElement('canvas');
        tile.width=512;tile.height=256;
        const g=tile.getContext('2d');
        g.fillStyle=base;g.fillRect(0,0,512,256);
        g.strokeStyle=reed;g.lineWidth=2;g.globalAlpha=.55;
        for(let y=0;y<256;y+=8){
            g.beginPath();
            for(let x=-8+(y%16);x<512;x+=16){
                g.moveTo(x,y+6);g.lineTo(x+6,y);g.lineTo(x+12,y+6);
            }
            g.stroke();
        }
        g.globalAlpha=1;
        for(const y of [8,207]){
            g.fillStyle=trim;g.fillRect(0,y,512,3);g.fillRect(0,y+31,512,3);
            g.fillStyle=reed;
            for(let x=-16;x<512;x+=32){
                g.beginPath();g.moveTo(x,y+27);g.lineTo(x+14,y+6);g.lineTo(x+28,y+27);g.fill();
                g.fillStyle=base;g.fillRect(x+13,y+17,3,8);g.fillStyle=reed;
            }
        }
        const map=new T.CanvasTexture(tile);map.colorSpace=T.SRGBColorSpace;
        return new T.MeshStandardMaterial({map,roughness:.91,side:T.DoubleSide});
    }
    const coir=weave('#724728','#b7884c','#eed3a1');
    const mantle=weave('#174d48','#498578','#e9c783');
    const sash=weave('#923d2d','#d67e47','#efd7a2');
    function garment(parent,rows,mat) {
        const geo=profile(rows);
        // Unroll the seam for texturing, retaining the smooth profile normals.
        const flat=geo.toNonIndexed();geo.dispose();
        const uv=flat.attributes.uv;
        for(let i=0;i<uv.count;i+=3){
            if(Math.max(uv.getX(i),uv.getX(i+1),uv.getX(i+2))<.95)continue;
            for(let j=i;j<i+3;j++)if(uv.getX(j)===0)uv.setX(j,1);
        }
        const obj=new T.Mesh(flat,mat);
        obj.castShadow=true;parent.add(obj);return obj;
    }
    // High-neck underlayer closes the collar and the arm openings as the
    // shoulder girdle rotates independently of the hips.
    mesh(spine,profile([[-.085,.18,.15],[.15,.16,.13],[.40,.236,.15],
        [.49,.253,.145],[.545,.16,.106],[.592,.081,.075],[.608,.070,.068]]),cloth);
    oval(spine,skin,0,.62,-.012,.067,.088,.067);
    garment(spine,[[-.015,.189,.168],[.09,.181,.149],[.20,.181,.143],
        [.32,.216,.169],[.43,.256,.173],[.485,.263,.157],[.52,.222,.14],
        [.557,.15,.112],[.576,.09,.087]],coir);
    // Woven shoulder yoke, with a shell clasp at front and back.
    garment(spine,[[.378,.251,.183],[.415,.263,.185],[.47,.271,.177],
        [.508,.244,.158],[.55,.17,.124],[.582,.09,.09]],mantle);
    for(const side of [-1,1]){
        oval(spine,0x523d28,0,.407,side*.183,.043,.050,.014);
        oval(spine,0xe8d4a6,0,.410,side*.193,.032,.042,.010);
        oval(spine,0xab835c,0,.410,side*.202,.004,.024,.003);
    }
    const wrap=garment(hips,[[-.244,.244,.206],[-.20,.24,.201],[-.10,.221,.182],
        [.016,.198,.173],[.08,.181,.153]],mantle);
    garment(hips,[[-.015,.201,.179],[.038,.198,.173],[.088,.19,.159]],sash);

    mesh(neck,profile([[-.005,.047,.052,-.03],[.025,.08,.082,-.025],
        [.08,.097,.104,-.013],[.146,.106,.112],[.209,.098,.105],[.252,.069,.079],[.267,.01,.012]]),skin);
    for(const side of [-1,1]){
        oval(neck,skin,side*.103,.119,.007,.022,.039,.021);
        oval(neck,0x352623,side*.043,.14,-.104,.016,.006,.006);
        oval(neck,hair,side*.044,.155,-.104,.023,.005,.006).rotation.z=side*.09;
        oval(neck,band,side*.111,.094,.002,.009,.014,.009);
    }
    oval(neck,skin,0,.113,-.113,.022,.036,.027);
    oval(neck,0x884d39,0,.069,-.112,.026,.005,.005);
    oval(neck,hair,0,.198,.017,.11,.10,.115);
    oval(neck,hair,0,.143,.065,.10,.082,.071);
    const knot=joint(neck,0,.259,.077);
    oval(knot,hair,0,.016,.012,.077,.061,.073);
    for(let i=0;i<7;i++){
        const a=i*.898;
        oval(knot,0x382b27,.045*Math.cos(a),.033,.012+.046*Math.sin(a),.03,.034,.032);
    }
    mesh(neck,profile([[.18,.109,.114,.012],[.198,.111,.117,.012]]),0xc55e3c);

    const thigh=.425,calf=.411;
    const limbs=[-1,1].map(s=>{
        const leg=limb(hips,s*.105,0,thigh,[
            [-.835,.044,.048],[-.79,.042,.051],[-.71,.047,.059,.013],[-.64,.068,.082,.021],
            [-.57,.079,.088,.025],[-.51,.072,.075,.021],[-.47,.058,.061,.006],
            [-.425,.066,.068,-.012],[-.365,.076,.086,-.014],[-.30,.087,.098,-.012],
            [-.21,.104,.119],[-.13,.114,.125],[-.045,.105,.12],[.045,.073,.085]
        ],true);
        garment(leg.anchor,[[-.313,.096,.109,-.012],[-.27,.101,.118,-.008],
            [-.185,.117,.13],[-.105,.122,.133],[-.04,.111,.127]],mantle);
        garment(leg.bend,[[-.352,.052,.06],[-.265,.066,.082,.014],
            [-.185,.085,.098,.021],[-.118,.082,.092,.019],[-.089,.075,.084,.018]],coir);
        const foot=joint(leg.bend,0,-calf);
        oval(foot,skin,0,-.007,-.054,.057,.049,.113);
        oval(foot,0x594632,0,-.041,-.058,.061,.022,.128);
        oval(foot,0x8a643f,0,.012,-.073,.06,.032,.026);
        const arm=limb(spine,s*.222,.477,.273,[
            [-.517,.032,.034],[-.467,.037,.04],[-.397,.049,.058],[-.345,.059,.064],
            [-.305,.051,.051],[-.273,.047,.05,.009],[-.235,.049,.061,.006],
            [-.177,.065,.088,.005],[-.132,.071,.091],[-.095,.066,.078],
            [-.057,.084,.088],[-.012,.089,.085],[.025,.074,.071],[.055,.047,.05],[.069,.009,.013]
        ]);
        oval(arm.bend,skin,0,-.281,-.007,.04,.06,.039);
        oval(arm.bend,skin,-s*.03,-.267,-.032,.017,.034,.019);
        garment(arm.bend,[[-.235,.042,.045],[-.195,.049,.053],
            [-.111,.059,.068],[-.068,.065,.069]],coir);
        garment(arm.anchor,[[-.118,.082,.10],[-.074,.102,.11],
            [-.026,.108,.108],[.021,.094,.093],[.053,.066,.065],[.067,.015,.018]],s<0?coir:mantle);
        return {s,leg,foot,arm};
    });
    let lastTime=0,airborne=false,impact=0;
    const mix=T.MathUtils.lerp;
    return function pose(state,distance,p,t,menu,stumble=0){
        const dt=Math.min(.08,Math.max(0,t-lastTime));lastTime=t;
        const running=state==='playing',air=T.MathUtils.smoothstep(p.y,0,.3);
        if(running && !p.y && airborne)impact=1;
        if(!running)impact=0;
        airborne=p.y>0;impact*=Math.exp(-11*dt);
        const cycle=running?distance/4.25:0,angle=cycle*2*Math.PI;
        const c=p.crouch, travel=running?(1-c)*(1-air):0;
        const lean=p.lane*1.55-p.x, breath=Math.sin(t*2.2)*.008;
        root.position.set(p.x,p.y,stumble*.48);root.rotation.z=-lean*.105-stumble*.61;
        root.rotation.y=menu*2.48*(1-stumble)-lean*.15+stumble*.48;
        const hipY=mix(.855+.043*Math.cos(angle*2)*travel-.086*impact,.335,c);
        hips.position.set(.021*Math.sin(angle)*travel,hipY,0);
        hips.rotation.y=.1*Math.sin(angle)*travel;
        spine.rotation.set(-.08-.12*travel-.93*c-.12*air+breath,-.23*Math.sin(angle)*travel,.032*Math.sin(angle)*travel);
        neck.rotation.x=-spine.rotation.x*.73;
        neck.rotation.y=-spine.rotation.y*.55-lean*.12;
        wrap.rotation.z=.032*Math.sin(angle)*travel;
        knot.rotation.x=.08*Math.sin(angle*2)*travel;
        for(const {s,leg,foot,arm} of limbs){
            const phase=(cycle+(s>0?.5:0))%1;
            // During stance the ankle travels backward with the paving. The
            // recovery arc lifts the heel and brings the foot forward again.
            const stance=.19, swing=Math.max(0,(phase-stance)/(1-stance));
            const stride=.5*4.25*stance;
            const z=phase<stance? -stride+4.25*phase : stride*Math.cos(swing*Math.PI);
            const lift=.29*Math.sin(swing*Math.PI)**1.5;
            let targetZ=mix(s*.055,z,travel);
            let targetY=.066+lift*travel;
            targetZ=mix(targetZ,s*.29,air);targetY+=air*(s>0?.31:.18);
            targetZ=mix(targetZ,s>0?-.69:.27,c);
            const down=hipY-targetY;
            const reach=T.MathUtils.clamp(Math.hypot(down,targetZ),.035,thigh+calf-.0001);
            const knee=Math.acos(T.MathUtils.clamp((reach*reach-thigh*thigh-calf*calf)/(2*thigh*calf),-1,1));
            const upper=Math.atan2(-targetZ,down)+Math.atan2(calf*Math.sin(knee),thigh+calf*Math.cos(knee));
            leg.anchor.rotation.set(upper,0,s*.095*c);
            leg.bend.rotation.x=-knee;
            foot.rotation.x=knee-upper+.44*Math.sin(swing*Math.PI*2)*travel;
            const counter=Math.cos(phase*2*Math.PI)*travel;
            arm.anchor.rotation.set(-.28-.82*counter+s*.46*air-.23*c,0,s*(.12+.27*c+.13*air));
            arm.bend.rotation.x=.62+.66*travel-.25*counter+.32*air;
        }
    };
}
