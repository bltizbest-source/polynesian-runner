import * as T from './vendor/three.module.min.js';
import {paintedMaterial} from './character-material.js';
import {createNavigatorHead} from './navigator.js';
import {ease,impactPose,footPath,runStride,walkStride,stridePhase} from './motion.js';

// The character faces -Z. Profiles describe elliptical cross-sections in metres.
export function createRunner(scene) {
    const root = new T.Group();
    scene.add(root);
    const skin = 0xb97755, band = 0xe2b568;
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
    neck.scale.setScalar(1.075);
    const armorGrip=joint(spine,-.12,.439,.202),gripPosition=new T.Vector3();
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
        const map=new T.CanvasTexture(tile);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
        return new T.MeshStandardMaterial({map,roughness:.91,side:T.DoubleSide});
    }
    const coir=weave('#73503e','#ae8056','#e9cb9b');
    const mantle=paintedMaterial('navigator-mantle',.91);mantle.side=T.DoubleSide;
    const sash=paintedMaterial('navigator-sash',.88);sash.side=T.DoubleSide;
    // Bias-cut fabric follows the back surface from shoulder to opposite hip.
    function panel(parent,rows,mat){
        const vertices=[],uv=[],indices=[];
        for(const [i,[x,y,z,width,tilt]] of rows.entries()){
            for(let k=0;k<3;k++){
                const s=k-1;
                vertices.push(x+s*width,y+s*tilt,z+.012*(1-s*s));
                uv.push(k/2,1-i/(rows.length-1));
                if(i && k){const n=i*3+k;indices.push(n-4,n-1,n,n-4,n,n-3);}
            }
        }
        const geo=new T.BufferGeometry();
        geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
        geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
        const part=new T.Mesh(geo,mat);part.castShadow=true;parent.add(part);return part;
    }
    function shellClasp(x,y,z,side){
        const points=[],faces=[],tints=[];
        const ivory=new T.Color(0xffe6b5),ochre=new T.Color(0xcf9860);
        for(let ring=0;ring<=5;ring++)for(let i=0;i<=28;i++){
            const a=(i/28-.5)*2.64,r=.05*(.015+ring/5),rib=.5+.5*Math.cos(i*Math.PI/2);
            points.push(x+r*Math.sin(a)*.85,y+r*Math.cos(a),z+side*(.009*(1-ring/5)+.006*rib*ring/5));
            const c=ochre.clone().lerp(ivory,.28+.43*rib+.24*ring/5);
            tints.push(c.r,c.g,c.b);
            if(i && ring){const n=ring*29+i;faces.push(n-30,n-1,n,n-30,n,n-29);}
        }
        const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));
        geo.setAttribute('color',new T.Float32BufferAttribute(tints,3));geo.setIndex(faces);geo.computeVertexNormals();
        spine.add(new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.46})));
    }
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
    const tunic=garment(spine,[[-.028,.192,.172],[.07,.187,.158],[.17,.18,.148],
        [.27,.205,.157],[.35,.232,.173],[.408,.246,.179],[.449,.252,.176],
        [.48,.25,.165]],mantle);
    // Let the collar rise under the shoulder sash and dip below the bare arm.
    const edge=tunic.geometry.attributes.position;
    for(let i=0;i<edge.count;i++){
        const x=edge.getX(i),y=edge.getY(i);
        const w=T.MathUtils.smoothstep(y,.28,.48);
        edge.setY(i,y-w*(.045+.073*x/.25));
    }
    shellClasp(-.086,.385,-.202,-1);
    const wrap=garment(hips,[[-.244,.244,.206],[-.20,.24,.201],[-.10,.221,.182],
        [.016,.198,.173],[.08,.181,.153]],mantle);
    const hem=wrap.geometry.attributes.position;
    for(let i=0;i<hem.count;i++){
        const x=hem.getX(i),y=hem.getY(i),z=hem.getZ(i),a=Math.atan2(z,x);
        const weight=T.MathUtils.smoothstep(-y,.01,.244);
        hem.setXYZ(i,x*(1+.027*weight*Math.cos(8*a)),
            y-weight*(.046+.040*Math.sin(a+.64)+.012*Math.cos(3*a)),z*(1+.025*weight*Math.cos(8*a)));
    }
    garment(hips,[[-.015,.201,.179],[.038,.198,.173],[.088,.19,.159]],sash);
    panel(spine,[[.13,.06,-.163,.064,.024],[.04,.21,-.168,.081,.03],[-.064,.34,-.193,.088,.03],
        [-.128,.443,-.195,.084,.025],[-.158,.51,-.149,.074,.025],[-.168,.548,-.086,.068,.018],
        [-.168,.557,0,.068,.018],[-.168,.542,.083,.072,.020],[-.155,.506,.142,.077,.025],
        [-.14,.46,.179,.088,.031],[-.084,.36,.19,.093,.034],[-.025,.25,.178,.087,.036],
        [.064,.139,.16,.081,.035],[.122,.056,.153,.069,.028],[.135,.018,.146,.06,.02]],sash);
    const tails=joint(hips,.117,.052,.152);
    panel(tails,[[0,0,.005,.074,.012],[.022,-.10,.033,.095,.018],[.028,-.23,.074,.104,.012],
        [.011,-.34,.115,.094,.017],[-.022,-.455,.139,.069,.038]],sash);
    shellClasp(-.12,.416,.195,1);

    // The flask sits behind the opposite hip, clear of the swinging hand.
    const flask=joint(hips,-.158,.012,.126);
    flask.rotation.z=-.22;
    mesh(flask,profile([[-.148,.023,.021],[-.138,.057,.046],[-.106,.071,.052],
        [-.064,.068,.05],[-.034,.049,.039],[-.015,.025,.023],[.006,.019,.019],[.021,.024,.022]]),0x995b36);
    garment(flask,[[-.117,.068,.052],[-.094,.074,.055],[-.079,.071,.054]],coir);
    oval(flask,0xd5b886,0,.026,0,.019,.024,.017);
    function cord(parent,points,radius,color){
        const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
        return mesh(parent,new T.TubeGeometry(path,16,radius,5,false),color);
    }
    cord(flask,[[-.036,-.036,.015],[-.050,.026,.004],[0,.061,-.013],[.04,.018,.013],[.039,-.052,.032]],.006,0xd5ae78);
    cord(spine,[[-.075,.561,-.045],[-.073,.532,-.111],[0,.477,-.164],[.085,.526,-.111],[.078,.56,-.04]],.005,0x765037);
    const pendant=mesh(spine,new T.LatheGeometry([[0,-.033],[.014,-.014],[.021,.006],[.013,.021],[.005,.026],[0,.026]]
        .map(([r,y])=>new T.Vector2(r,y)),12),0x438a7e);
    pendant.position.set(0,.454,-.169);pendant.scale.z=.48;
    const knot=createNavigatorHead(neck);
    for(const side of [-1,1]){
        const ear=joint(neck,side*.107,.143,.005);
        ear.rotation.x=.16;
        oval(ear,skin,side*.003,0,0,.018,.033,.019);
        oval(ear,0xb47456,side*.016,.001,.001,.0035,.019,.011);
        cord(ear,[[side*.014,-.018,.007],[side*.020,-.002,.015],[side*.021,.022,.012],
            [side*.016,.028,-.001],[side*.012,.017,-.013]],.004,skin);
        oval(ear,band,side*.014,-.028,-.003,.005,.006,.005);
    }
    const tie=joint(knot,.036,-.022,.049);
    panel(tie,[[0,0,0,.018,.001],[.015,-.067,.029,.022,.003],[.022,-.125,.041,.014,.010]],sash);

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
        for(const side of [-1,1])
            cord(foot,[[side*.052,-.025,-.092],[side*.032,.028,-.076],[-side*.026,.032,-.044],[-side*.051,-.02,-.025]],.008,0xb48753);
        const arm=limb(spine,s*.222,.477,.273,[
            [-.517,.032,.034],[-.467,.037,.04],[-.397,.049,.058],[-.345,.059,.064],
            [-.305,.051,.051],[-.273,.047,.05,.009],[-.235,.049,.061,.006],
            [-.177,.065,.088,.005],[-.132,.071,.091]
        ]);
        const wrist=joint(arm.bend,0,-.249);
        oval(wrist,skin,0,-.032,0,.032,.048,.041);
        // Relaxed fingers curl toward the palm, with staggered knuckles.
        for(let finger=0;finger<4;finger++){
            const length=.027-.003*Math.abs(finger-1);
            const digit=oval(wrist,skin,-s*.006,-.061+finger*.002,
                -.028+finger*.018,.015,length,.011);
            digit.rotation.z=-s*.48;
        }
        oval(wrist,skin,-s*.024,-.033,-.030,.014,.030,.016).rotation.x=.42;
        garment(arm.bend,[[-.235,.042,.045],[-.195,.049,.053],
            [-.111,.059,.068],[-.068,.065,.069]],coir);
        garment(arm.anchor,[[-.153,.075,.091],[-.137,.082,.096],[-.109,.087,.096]],
            s<0?sash:mantle);
        return {s,leg,foot,arm,wrist};
    });
    // A single skinned shoulder girdle joins the neck, chest and deltoids.
    // Its two armholes grow into sleeves that rotate with the upper arms.
    const chest=[
        [-.08,.173,.144],[.16,.169,.13],[.32,.208,.149],[.386,.229,.161],
        [.416,.237,.166],[.455,.248,.161],[.49,.24,.145],[.523,.200,.123],
        [.55,.136,.099],[.578,.084,.082],[.631,.070,.071,-.004],[.672,.066,.063,-.006],
        [.707,.063,.055,-.008],[.731,.045,.036,-.010]
    ];
    const sides=40, bottom=3, top=7, arc=4;
    const vertices=[],triangles=[],boneIndices=[],boneWeights=[];
    function vertex(x,y,z,bone=0,weight=0){
        vertices.push(x,y,z);boneIndices.push(0,bone,0,0);boneWeights.push(1-weight,weight,0,0);
        return vertices.length/3-1;
    }
    function index(row,column){return row*sides+(column+sides)%sides;}
    for(const [i,[y,rx,rz,cz=0]] of chest.entries()){
        for(let j=0;j<sides;j++){
            const angle=j*2*Math.PI/sides;
            vertex(rx*Math.cos(angle),y,cz+rz*Math.sin(angle));
            const edge=(j+arc)%(sides/2);
            if(!i || (i>bottom && i<=top && edge<2*arc))continue;
            const a=index(i-1,j),b=index(i,j),c=index(i-1,j+1),d=index(i,j+1);
            triangles.push(a,b,c,c,b,d);
        }
    }
    limbs.forEach(({s,arm},armIndex)=>{
        const center=s>0?0:sides/2,boundary=[];
        for(let j=-arc;j<arc;j++)boundary.push([bottom,j]);
        for(let row=bottom;row<top;row++)boundary.push([row,arc]);
        for(let j=arc;j>-arc;j--)boundary.push([top,j]);
        for(let row=top;row>bottom;row--)boundary.push([row,-arc]);
        let previous=boundary.map(([row,j])=>index(row,center+j));
        for(let ring=1;ring<=5;ring++){
            const t=ring/5,bulge=Math.sin(Math.PI*t);
            const next=boundary.map(([row,j])=>{
                const base=index(row,center+j)*3;
                const [x,y,z]=vertices.slice(base,base+3);
                const angle=Math.atan2(j/arc,2*(chest[row][0]-chest[bottom][0])/(chest[top][0]-chest[bottom][0])-1);
                const outer=Math.cos(angle),depth=s*Math.sin(angle);
                const endX=arm.anchor.position.x+s*.071*outer,endY=arm.anchor.position.y-.134;
                return vertex(x+(endX-x)*t+s*.031*bulge*Math.max(0,outer),
                    y+(endY-y)*t+.032*bulge*Math.max(0,outer),
                    z+(.090*depth-z)*t+.012*bulge*depth,armIndex+1,T.MathUtils.smootherstep(t,0,1));
            });
            for(let j=0;j<next.length;j++){
                const k=(j+1)%next.length;
                triangles.push(previous[j],next[j],previous[k],previous[k],next[j],next[k]);
            }
            previous=next;
        }
    });
    const upperBody=new T.BufferGeometry();
    upperBody.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    upperBody.setAttribute('skinIndex',new T.Uint16BufferAttribute(boneIndices,4));
    upperBody.setAttribute('skinWeight',new T.Float32BufferAttribute(boneWeights,4));
    upperBody.setIndex(triangles);upperBody.computeVertexNormals();
    const shoulders=new T.SkinnedMesh(upperBody,material(skin));
    spine.add(shoulders);spine.updateWorldMatrix(true,true);
    shoulders.bind(new T.Skeleton([spine,...limbs.map(l=>l.arm.anchor)]));
    shoulders.castShadow=true;shoulders.frustumCulled=false;
    const inversePelvis=new T.Quaternion(),ankleTarget=new T.Vector3();
    let lastTime=0,airborne=false,impact=0;
    const mix=T.MathUtils.lerp;
    return function pose(state,distance,p,t,menu,stumble=0,bite=null,hold=0,intro=0){
        const dt=Math.min(.08,Math.max(0,t-lastTime));lastTime=t;
        const opening=state==='intro';
        const glance=opening ? Math.sin(Math.PI*T.MathUtils.smoothstep(intro,3.4,6.1)) : 0;
        const walking=opening && intro<4.62;
        const falling=p.drop, pivot=p.pivot;
        const collision=p.impact && impactPose(p.impact.kind,p.impact.phase);
        const drop=falling?ease(falling.phase/.52):0;
        const running=state==='playing' || state==='falling' || opening,air=T.MathUtils.smoothstep(p.y,0,.3);
        if(running && !p.y && airborne)impact=1;
        if(!running)impact=0;
        airborne=p.y>0;impact*=Math.exp(-11*dt);
        const stride=walking?walkStride:runStride, stance=walking?.54:.177;
        const cycle=running?stridePhase(distance,stride):0,angle=cycle*2*Math.PI;
        const support=Math.cos(angle-stance*Math.PI);
        const drive=opening && !walking?ease((intro-5.17)/1.15):1;
        const c=p.crouch, travel=running?drive*(1-c)*(1-air)*(1-drop)*(1-(collision?.weight||0))*(1-Math.max(p.fallen,p.kneeling)):0;
        const {fallen, kneeling} = p;
        const lean=T.MathUtils.clamp((p.laneVelocity||0)*.12,-1.55,1.55), breath=Math.sin(t*2.2)*.008;
        root.position.set(p.x,p.y,stumble*.48);root.rotation.z=-lean*.105-stumble*.61;
        root.rotation.y=menu*2.48*(1-stumble)-lean*.15+stumble*.48;
        if(pivot){
            root.rotation.y+=pivot.yaw;
            root.rotation.z-=pivot.lean*.26;
        }
        const load=Math.cos(2*(angle-Math.PI*stance));
        const height=walking?.815+.016*load:.815-.040*load;
        const hipY=mix(.845+(height-.845)*travel-.086*impact,.335,c);
        hips.position.set(-.021*support*travel,hipY,0);
        // Pivot at the pelvis so the shoulder lands beside the hip. The trailing
        // leg folds under the body as the hands push it back onto one knee.
        hips.position.y = mix(hipY, .255, fallen);
        hips.position.y = mix(hips.position.y, .44, kneeling);
        hips.rotation.x = -.24*fallen - .16*kneeling;
        hips.rotation.y=-.112*Math.cos(angle-.2)*travel;
        spine.rotation.set(-.08+((walking?-.02:-.15)+.028*load)*travel-.93*c-.12*air+breath,
            .235*Math.cos(angle-.36)*travel,-.055*support*travel);
        hips.rotation.z=-.050*support*travel + 1.48*fallen + .13*kneeling;
        spine.rotation.y-=.45*glance+.26*fallen;
        spine.rotation.x-=.16*fallen+.50*kneeling;
        spine.rotation.x+=walking ? .12 : 0;
        neck.rotation.x=-spine.rotation.x*.73;
        neck.rotation.y=-.78*(hips.rotation.y+spine.rotation.y)-lean*.12-1.34*glance;
        neck.rotation.z=-(hips.rotation.z+spine.rotation.z)*.78*travel;
        if(pivot){
            hips.position.y-=.13*pivot.plant;
            spine.rotation.y-=pivot.lean*.32;
            neck.rotation.y-=pivot.lean*.35;
        }
        if(collision){
            const w=collision.weight;
            hips.position.y=mix(hips.position.y,collision.height,w);
            hips.rotation.x=mix(hips.rotation.x,collision.pitch,w);
            hips.rotation.z=mix(hips.rotation.z,collision.roll,w);
            spine.rotation.x-=.18*w;neck.rotation.x+=.32*w;
        }
        if(drop){
            const skid=falling.kind==='corner', reaching=falling.kind==='zipline';
            hips.position.y-=drop*.12;
            hips.rotation.x-=drop*(reaching?.18:.60);
            hips.rotation.z+=drop*(skid?-.68*falling.direction:.20);
            neck.rotation.y-=skid?falling.direction*drop*.65:0;
            neck.rotation.x+=drop*(reaching?-.48:.24);
        }
        wrap.rotation.z=.032*Math.sin(angle)*travel;
        knot.rotation.x=.08*Math.sin(angle*2)*travel;
        tails.rotation.x=-.16-.58*travel-.18*air-.12*Math.sin(angle)*travel;
        tails.rotation.z=.13*Math.sin(angle-.7)*travel+(pivot?.lean||0)*.35;
        flask.rotation.x=-.06+.13*Math.sin(angle-.6)*travel+.14*air;
        tie.rotation.x=-.22-.35*travel+.12*Math.sin(angle)*travel;
        inversePelvis.copy(hips.quaternion).invert();
        for(const {s,leg,foot,arm,wrist} of limbs){
            const phase=stridePhase(cycle,1,s>0?.5:0);
            const step=footPath(phase,stride,stance,walking?.11:.395);
            const contact=Math.min(1,phase/stance);
            const roll=phase<stance
                ? .18*(1-ease(contact/.43))-(walking?.43:.70)*ease((contact-.47)/.53)
                : mix(walking?-.43:-.70,.18,ease((step.swing-.12)/.66));
            const pitch=roll*travel;
            const cos=Math.cos(pitch),sin=Math.sin(pitch);
            const sole=.041*cos-.058*sin+Math.hypot(.022*cos,.128*sin);
            let targetZ=mix(s*.055,step.z,travel);
            let targetY=sole+.003+step.y*travel;
            targetZ=mix(targetZ,s*.29,air);targetY+=air*(s>0?.31:.18);
            targetZ=mix(targetZ,s>0?-.69:.27,c);
            // Undo the pelvis sway and twist before solving for the ankle.
            // The sandal can stay on its mark while the torso passes over it.
            ankleTarget.set(leg.anchor.position.x,targetY,targetZ).sub(hips.position)
                .applyQuaternion(inversePelvis).sub(leg.anchor.position);
            const down=mix(hipY-targetY,Math.hypot(ankleTarget.x,ankleTarget.y),travel);
            targetZ=mix(targetZ,ankleTarget.z,travel);
            const reach=T.MathUtils.clamp(Math.hypot(down,targetZ),.035,thigh+calf-.0001);
            const knee=Math.acos(T.MathUtils.clamp((reach*reach-thigh*thigh-calf*calf)/(2*thigh*calf),-1,1));
            const upper=Math.atan2(-targetZ,down)+Math.atan2(calf*Math.sin(knee),thigh+calf*Math.cos(knee));
            const lateral=Math.atan2(ankleTarget.x,-ankleTarget.y);
            leg.anchor.rotation.set(upper,0,lateral*travel+s*.095*c,'ZXY');
            leg.bend.rotation.x=-knee;
            foot.rotation.x=knee-upper+pitch;
            foot.rotation.z=-(hips.rotation.z+leg.anchor.rotation.z)*travel;
            const counter=Math.cos(phase*2*Math.PI-.34)*travel;
            arm.anchor.rotation.set(-.28-(walking?.50:.87)*counter+s*.46*air-.23*c,
                -s*.12*counter,s*(.12+.27*c+.13*air));
            arm.bend.rotation.x=.62+(walking?.18:.68)*travel-.31*counter+.32*air;
            wrist.rotation.x=.15*Math.sin(phase*2*Math.PI-.70)*travel;
            // Tuck the lower arm at impact; plant the near foot and unfold the
            // other leg from the ground before blending back into the run.
            leg.anchor.rotation.x = mix(leg.anchor.rotation.x, s>0 ? .60 : .15, fallen);
            leg.bend.rotation.x = mix(leg.bend.rotation.x, s>0 ? -.92 : -.38, fallen);
            leg.anchor.rotation.x = mix(leg.anchor.rotation.x, s>0 ? 1.38 : -.24, kneeling);
            leg.bend.rotation.x = mix(leg.bend.rotation.x, s>0 ? -1.54 : -1.40, kneeling);
            foot.rotation.x = mix(foot.rotation.x, s>0 ? .16 : .95, kneeling);
            arm.anchor.rotation.x = mix(arm.anchor.rotation.x, .95, fallen + kneeling);
            arm.anchor.rotation.z = mix(arm.anchor.rotation.z, s*.23, fallen + kneeling);
            arm.bend.rotation.x = mix(arm.bend.rotation.x, 1.42, fallen);
            arm.bend.rotation.x = mix(arm.bend.rotation.x, .35, kneeling);
            if(pivot){
                const outside=s!==pivot.direction;
                leg.anchor.rotation.x+=pivot.plant*(outside?.20:-.30);
                leg.bend.rotation.x-=pivot.plant*(outside?.25:.56);
                arm.anchor.rotation.z+=s*pivot.plant*(outside?.65:.18);
                arm.anchor.rotation.x-=pivot.lean*s*.38;
            }
            if(collision){
                const w=collision.weight;
                leg.anchor.rotation.x=mix(leg.anchor.rotation.x,collision.thigh+(s>0?.22:-.28),w);
                leg.bend.rotation.x=mix(leg.bend.rotation.x,-collision.knee+(s>0?-.14:.12),w);
                arm.anchor.rotation.set(mix(arm.anchor.rotation.x,collision.reach+s*.17,w),0,s*(.15+.28*w));
                arm.bend.rotation.x=mix(arm.bend.rotation.x,.28+.72*Math.sin(Math.PI*p.impact.phase),w);
                foot.rotation.x=mix(foot.rotation.x,.22,w);
            }
            if(drop){
                const reach=falling.kind==='zipline' && s>0;
                arm.anchor.rotation.x=mix(arm.anchor.rotation.x,reach?2.9:.78+s*.30,drop);
                arm.anchor.rotation.z+=s*(reach?.18:1.1)*drop;
                arm.bend.rotation.x=mix(arm.bend.rotation.x,.25+.35*Math.sin(falling.phase*8+s),drop);
                leg.anchor.rotation.x+=drop*(s>0?.69:-.48);
                leg.bend.rotation.x-=drop*(s>0?1.03:.63);
            }
            if(p.grip>.001){
                const w=p.grip;
                arm.anchor.rotation.x=mix(arm.anchor.rotation.x,3.04,w);
                arm.anchor.rotation.z=mix(arm.anchor.rotation.z,s*.12,w);
                arm.bend.rotation.x=mix(arm.bend.rotation.x,.22,w);
                leg.anchor.rotation.x=mix(leg.anchor.rotation.x,.22+s*.13,w);
                leg.bend.rotation.x=mix(leg.bend.rotation.x,-.68,w);
            }
            if(bite){
                const lift=T.MathUtils.smoothstep(hold,.18,.86);
                arm.anchor.rotation.z+=s*lift*(.51+.14*Math.sin(t*8+s));
                leg.bend.rotation.x-=lift*(.27+.18*Math.sin(t*7+s));
            }
        }
        // Keep the clasp on the back of the armor between the teeth while the
        // head lifts and pulls. Both roots are in scene coordinates.
        if(bite){
            armorGrip.getWorldPosition(gripPosition);
            root.position.addScaledVector(gripPosition.subVectors(bite,gripPosition),
                T.MathUtils.smoothstep(hold,0,.22));
        }
        return root.position;
    };
}
