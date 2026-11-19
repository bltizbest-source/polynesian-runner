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
    function limb(parent,x,y,upper,rows) {
        const anchor=joint(parent,x,y);
        const g=profile(rows),weights=[],indices=[];
        for(let i=0;i<g.attributes.position.count;i++){
            const depth=-g.attributes.position.getY(i);
            const w=T.MathUtils.smoothstep(depth,upper-.065,upper+.065);
            indices.push(0,1,0,0);weights.push(1-w,w,0,0);
        }
        g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));
        g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
        const surface=new T.SkinnedMesh(g,material(skin));
        const top=new T.Bone(),bend=new T.Bone();
        bend.position.y=-upper;top.add(bend);surface.add(top);
        surface.bind(new T.Skeleton([top,bend]));
        surface.frustumCulled=false;surface.castShadow=true;anchor.add(surface);
        return {anchor,bend};
    }
    const hips=joint(root),spine=joint(hips),neck=joint(spine,0,.61,-.018);
    // Sample the ribs and taper densely enough to sculpt the scapulae and
    // spinal groove without a seam between the muscle groups.
    const ribcage=[
        [-.08,.154,.123],[.025,.183,.13],[.13,.151,.113],[.21,.164,.116],
        [.30,.202,.13],[.38,.234,.145],[.46,.249,.14],[.50,.238,.128],
        [.53,.193,.109],[.56,.128,.091],[.59,.076,.071],[.65,.067,.065]
    ];
    const rings=[];
    for(let i=1;i<ribcage.length;i++) {
        for(let step=0;step<4;step++)
            rings.push(ribcage[i-1].map((v,k)=>T.MathUtils.lerp(v,ribcage[i][k],step/4)));
    }
    rings.push(ribcage.at(-1));
    const chest=profile(rings),verts=chest.attributes.position;
    function mound(x,y,width,height) {return Math.exp(-(x*x/(width*width)+y*y/(height*height)));}
    for(let i=0;i<verts.count;i++){
        const x=Math.abs(verts.getX(i)),y=verts.getY(i),z=verts.getZ(i);
        const facing=Math.min(1,Math.abs(z)/.12);
        if(z>0){
            const traps=.039*mound(x-.057-(.49-y)*.3,y-.46,.052,.105);
            const shoulderBlade=.043*mound(x-.119,y-.386,.066,.071);
            const lat=.047*mound(x-(.099+.50*(y-.29)),y-.29,.056,.103);
            const lowerBack=.021*mound(x-.048,y-.15,.023,.11);
            const groove=.015*mound(x,y-.33,.018,.185);
            verts.setZ(i,z+facing*(traps+shoulderBlade+lat+lowerBack-groove));
        }else{
            const pec=.046*mound(x-.104,y-.414,.086,.064);
            const abs=.016*mound(x-.043,y-.22,.033,.10);
            verts.setZ(i,z-facing*(pec+abs));
        }
    }
    chest.computeVertexNormals();mesh(spine,chest,skin);
    // Cloth follows the waist, with a contrasting woven border on the hem.
    const wrap=mesh(hips,profile([[-.18,.204,.164],[-.16,.21,.163],[.015,.184,.15],[.089,.162,.12]]),cloth);
    mesh(wrap,profile([[-.165,.212,.165],[-.147,.211,.166]]),band);
    mesh(hips,profile([[.043,.176,.14],[.073,.169,.134],[.096,.161,.125]]),0xc34f32);
    // Fit the sash to the sculpted back at each height, including its taper.
    const ribbon=[],faces=[];
    for(let r=0;r<rings.length;r++){
        const [y,rx]=rings[r];
        if(y<.07 || y>.525)continue;
        const row=ribbon.length/6;
        for(const edge of [-1,1]){
            const x=T.MathUtils.clamp(-.137+(y-.07)*.71+edge*.025,-rx*.98,rx*.98);
            const u=Math.acos(x/rx)*28/(2*Math.PI),j=Math.floor(u);
            const z=T.MathUtils.lerp(verts.getZ(r*28+j),verts.getZ(r*28+j+1),u-j);
            ribbon.push(x,y,z+.0045);
        }
        if(row>0){const n=row*2;faces.push(n-2,n-1,n,n,n-1,n+1);}
    }
    const ribbonMesh=new T.BufferGeometry();
    ribbonMesh.setAttribute('position',new T.Float32BufferAttribute(ribbon,3));
    ribbonMesh.setIndex(faces);ribbonMesh.computeVertexNormals();mesh(spine,ribbonMesh,0xb75533);

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
        ]);
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
        oval(arm.bend,band,0,-.222,0,.036,.018,.039);
        return {s,leg,foot,arm};
    });
    let lastTime=0,airborne=false,impact=0;
    const mix=T.MathUtils.lerp;
    return function pose(state,distance,p,t,menu){
        const dt=Math.min(.08,Math.max(0,t-lastTime));lastTime=t;
        const running=state==='playing',air=T.MathUtils.smoothstep(p.y,0,.3);
        if(running && !p.y && airborne)impact=1;
        if(!running)impact=0;
        airborne=p.y>0;impact*=Math.exp(-11*dt);
        const cycle=running?distance/4.25:0,angle=cycle*2*Math.PI;
        const c=p.crouch, travel=running?(1-c)*(1-air):0;
        const lean=p.lane*1.55-p.x, breath=Math.sin(t*2.2)*.008;
        root.position.set(p.x,p.y,0);root.rotation.z=-lean*.105;
        root.rotation.y=menu*2.48-lean*.15;
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
