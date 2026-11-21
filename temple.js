import {courses,trackPoint,routePoint,cableHeight} from './courses.js';
import {renderPixelRatio} from './viewport.js';
import * as T from './vendor/three.module.min.js';
import {caveFaces,tripStoneAt} from './cave.js';
import {createRunner} from './runner.js';
import {createPursuer} from './pursuer.js';

// Each course is built once. Its static scenery shares instanced geometry.
export function createTempleScene(canvas) {
    const renderer = new T.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=T.PCFSoftShadowMap;
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(58,1,.1,160);
    scene.background=new T.Color(0xd0bc87);
    scene.fog=new T.FogExp2(0xabc4a4,.023);
    scene.add(new T.HemisphereLight(0xfff2dc,0x799481,1.52));
    const sun=new T.DirectionalLight(0xffe2b4,2.65);
    sun.position.set(-11,19,1);sun.target.position.set(0,0,-11);
    sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
    Object.assign(sun.shadow.camera,{left:-17,right:17,top:17,bottom:-17,near:.2,far:59});
    sun.shadow.normalBias=.027;sun.shadow.bias=-.0003;
    scene.add(sun,sun.target);
    const sky=new T.Mesh(new T.SphereGeometry(145,24,12),new T.ShaderMaterial({
        side:T.BackSide,depthWrite:false,
        vertexShader:'varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:`varying vec3 v; void main(){vec3 d=normalize(v);
            float h=smoothstep(-.02,.65,d.y),s=dot(d,normalize(vec3(-.42,.42,-1.)));
            vec3 col=mix(vec3(.82,.85,.71),vec3(.35,.68,.71),h);
            col+=vec3(.28,.17,.02)*pow(max(s,0.),18.);
            col=mix(col,vec3(1.,.92,.68),smoothstep(.992,.995,s));gl_FragColor=vec4(col,1.);}`
    }));
    scene.add(sky);
    const box=new T.BoxGeometry(), rock=new T.DodecahedronGeometry(.5), gem=new T.OctahedronGeometry(.5);
    const pole=new T.CylinderGeometry(.46,.52,1,7), cone=new T.ConeGeometry(.5,1,7);
    const mat=new T.MeshStandardMaterial({flatShading:true,roughness:.95});
    const spray=rock.clone(), foam=mat.clone(), sprayTime={value:0};
    foam.onBeforeCompile=shader=>{
        shader.uniforms.sprayTime=sprayTime;
        shader.vertexShader='uniform float sprayTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',
            '#include <begin_vertex>\nfloat surge = smoothstep(-0.25, 0.9, sin(sprayTime * 2.0 + instanceMatrix[3].z * 0.16));\ntransformed.y = (transformed.y + 0.5) * (0.16 + 0.84 * surge) - 0.5;');
    };
    // A ridged, tapering leaf catches light on both sides of its midrib.
    const leaf=new T.BufferGeometry();
    leaf.setAttribute('position',new T.Float32BufferAttribute([
        0,0,0, -.47,.18,.44, 0,.32,.48, 0,0,0, 0,.32,.48,.47,.18,.44,
        -.47,.18,.44,0,-.13,1,0,.32,.48, 0,.32,.48,0,-.13,1,.47,.18,.44
    ],3));leaf.computeVertexNormals();
    const leaves=mat.clone();leaves.side=T.DoubleSide;
    function buildLandscape(course) {
        const forest=new T.Group();scene.add(forest);
        const approach=new T.Group();forest.add(approach);
        forest.userData.approach=approach;
        const entranceBatches=new Map(), courseBatches=new Map(), temp=new T.Object3D();
        let batches=entranceBatches;
        function put(shape,color,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0) {
            const at=trackPoint(course,-z,x);
            temp.position.set(at.x,y,at.z);temp.scale.set(sx,sy,sz);temp.rotation.set(rx,ry-at.heading,rz,'YXZ');temp.updateMatrix();
            if(!batches.has(shape))batches.set(shape,[]);
            batches.get(shape).push([temp.matrix.clone(),new T.Color(color)]);
        }
        let seed=8925;
        function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
        const basalt=[0x536359,0x77806b,0x667565,0x899078], paving=course.stone;
        const green=[0x346748,0x4f8050,0x628d4d,0x235c49,0x7b9c4d];
        const pick=colors=>colors[Math.floor(random()*colors.length)];
        function palm(x,z,height) {
            const tilt=(random()-.5)*.22;
            put(pole,0x695b40,x,height*.46-.7,z,.43,height,.43,0,0,tilt);
            for(let i=0;i<10;i++){
                put(leaf,pick(green),x-height*.48*Math.sin(tilt),height*.96-.7,z,1.15+random(),2,2.2+random()*2,(random()-.45)*.58,i*.628+tilt);
            }
        }
        const [lagoon,lava,fern,cliffs,plains,falls]=courses.map(c=>c===course);
        for(let j=-36;j<course.length;j++){
            if(j===0)batches=courseBatches;
            const z=-j;
            for(let lane=-1;lane<=1;lane++){
                put(box,pick(paving),lane*1.58,-.19+random()*.012,z,1.58,.38,1.10);
                if(random()<.27)put(box,0x728160,lane*1.58+(random()-.5)*1.2,.01,z-.43,.1+random()*.38,.013,.09);
            }
            for(const s of [-1,1]){
                const x=s*2.55;
                put(box,pick(basalt),x,-.16,z,.37,.47,.97);
                if(j%4===0){
                    put(rock,0x637b53,s*(8.3+random()*2),-1.3,z,8,2.6,7.2);
                    put(box,0xa6bc98,s*(3.9+random()*1.3),-.894,z,.8+random(),.01,.045);
                    put(rock,pick(basalt),s*(4+random()*5),-.58,z,2+random()*2,1.6,2.3);
                    const fx=s*(3.1+random()*1.5);
                    for(let k=0;k<8;k++)put(leaf,pick(green),fx,-.32,z,.46,.9,1.34,-.48,k*.786);
                }
                if(j%5===0){
                    const x=s*(5.1+random()*4.5);
                    if(lagoon)palm(x,z,4.1+random()*4);
                    else if(lava){
                        put(rock,0x48404a,x,.3,z,3,3.6,3.7);
                        put(box,0xe87638,x,.12,z+1.7,2,.06,.15,0,.32);
                        if(j%15===0)put(cone,0x513f47,x*2.4,2,z,12,9,12);
                    }else if(fern){
                        put(pole,0x594b3b,x,1.5,z,.3,3,.3);
                        for(let k=0;k<12;k++)
                            put(leaf,k%2?0x658f68:0x366f52,x,2.9,z,.58,1.3,2.8,-.3,k*.524);
                    }else if(cliffs){
                        put(rock,0x948679,x,-.55,z,6,3.4,5.8);
                        if(j%15===0){
                            for(let k=0;k<7;k++){
                                const height=1.8+2*Math.sin(k*.97)**2;
                                put(spray,k%2?0xc5e9e5:0xe3f4ea,x+Math.sin(k)*.38,height*.5,z+Math.cos(k)*.33,.36,height,.38,0,0,Math.sin(k)*.22);
                            }
                        }
                    }else if(plains){
                        put(rock,0x919049,x,-.3,z,9,2.1,8);
                        for(let k=0;k<5;k++)put(leaf,k%2?0xc6ae5e:0xb59a49,x+Math.sin(k),.6,z+Math.cos(k),.26,1,1.6,-1.15,k);
                        if(j%15===0)put(rock,0x77604f,x*2,.7,z,7,4.2,9);
                    }else if(falls){
                        const height=7+random()*5;
                        put(rock,0x466352,x*1.4,height*.36,z,8,height,9);
                        if(j%20===0){
                            for(let k=-1;k<=1;k++)put(box,k?0x9ed3d0:0xe0ece0,x*1.4-s*2.9,height*.32,z+k*.48,.3,height*.72,.52,0,0,-s*.13);
                            put(rock,0xccdfd3,x*1.4-s*3.4,-.2,z,2.4,.7,2.8);
                        }
                    }
                }
                if((lagoon || fern || falls) && j%7===0){
                    const tx=s*(10+random()*10), ht=5+random()*7;
                    put(pole,0x4f523c,tx,ht*.47-.9,z,1.1,ht,1);
                    put(rock,pick(green),tx,ht-.6,z,6,4,6);
                }
                if(j%12===6){
                    put(pole,0x534d39,x,.72,z,.18,1.6,.18);
                    put(pole,0xbc965b,x,1.44,z,.35,.25,.35);
                    put(gem,0xff9936,x,1.85,z,.32,.84,.32);
                    put(cone,0xffdb73,x,1.89,z+.08,.19,.55,.19);
                }
            }
            if(lagoon && j%36===14){
                const x=7;
                put(box,0xa68159,x,.3,z,4.4,.35,3.2);
                for(const sx of [-1,1])for(const sz of [-1,1])
                    put(pole,0x835c3c,x+sx*1.55,1.35,z+sz, .18,2,.18);
                put(rock,0xc6a069,x,2.55,z,5.7,2.3,4.8);
            }
        }
        // Poles straddle the zip lane; a sagging cable joins the crossarms.
        const cable=course.cable, laneX=cable.lane*1.55;
        for(const d of [cable.at,cable.end]){
            const y=cableHeight(cable,d)+.40;
            const side=laneX<0?-1:1;
            put(pole,0x825837,side*2.66,y/2,-d,.28,y,.28);
            put(box,0xa57d51,(side*2.66+laneX)/2,y,-d,Math.abs(side*2.66-laneX)+.18,.2,.22);
        }
        for(let d=cable.at;d<cable.end;d++){
            const y=cableHeight(cable,d)+.40, next=cableHeight(cable,d+1)+.40;
            put(box,0x453830,laneX,(y+next)/2,-d-.5,.075,.075,Math.hypot(1,next-y)+.02,Math.atan(next-y));
        }
        for(const x of [-2.75,2.75])put(pole,0xdbac65,x,1.8,-course.length,.22,3.6,.22);
        put(box,0xf0c279,0,3.48,-course.length,5.8,.32,.23);
        for(const [group,parts] of [[approach,entranceBatches],[forest,courseBatches]])for(const [shape,instances] of parts){
            const mesh=new T.InstancedMesh(shape,shape===leaf?leaves:shape===spray?foam:mat,instances.length);
            mesh.castShadow=shape!==spray;mesh.receiveShadow=true;
            instances.forEach(([matrix,color],i)=>{mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color);});
            group.add(mesh);
        }
        forest.visible=false;
        return forest;
    }
    const landscapes=new Map(), route=new T.Group();scene.add(route);
    const paletteEnd=new T.Color();
    function landscapeFor(course){
        if(!landscapes.has(course)){
            const landscape=buildLandscape(course);
            route.add(landscape);landscapes.set(course,landscape);
        }
        return landscapes.get(course);
    }
    let activeCourse,forest;
    const materials=new Map();
    function piece(parent,shape,color,x,y,z,sx,sy,sz) {
        if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,flatShading:true}));
        const obj=new T.Mesh(shape,materials.get(color));
        obj.castShadow=true;obj.receiveShadow=true;
        obj.position.set(x,y,z);obj.scale.set(sx,sy,sz);parent.add(obj);return obj;
    }
    const water=piece(scene,box,0x358888,0,-1.03,-56,300,.25,260);water.castShadow=false;
    for(let i=0;i<12;i++)piece(scene,rock,0x688575,(i-5)*17,-.8,-90-12*Math.cos(i*2.63),27,23+10*Math.sin(i*1.72),26);
    const cave=new T.Group();
    scene.add(cave);
    const positions=[], colors=[];
    for(const face of caveFaces){
        const color=new T.Color(face.color);
        for(const [x,y,d] of face.vertices){
            positions.push(x,y,-d);
            colors.push(color.r,color.g,color.b);
        }
    }
    const shell=new T.BufferGeometry();
    shell.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    shell.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    shell.computeVertexNormals();
    const vault=new T.Mesh(shell,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:1}));
    vault.castShadow=vault.receiveShadow=true;cave.add(vault);
    const floor=piece(cave,box,0x544c43,0,-.043,-5.5,6.25,.12,8.4);
    floor.castShadow=false;
    for(let i=0;i<32;i++){
        const d=1.55+(i*.731%1)*7.8, x=(i*.38197%1-.5)*5.9;
        const shard=piece(cave,rock,i%3?0x655d52:0x48494a,x,.027,-d,.16+i%5*.08,.037,.10+i%3*.05);
        shard.rotation.y=i*1.4;
    }
    for(let i=0;i<16;i++){
        const side=i%2?1:-1, d=1.45+i*.49;
        piece(cave,rock,i%3?0x485056:0x625f59,side*(2.95+.19*Math.sin(i)),.10,-d,1.25,.85,1.5);
        piece(cave,cone,0x404954,side*(1.45+.30*Math.cos(i)),3.70,-d,.35,.72,.44,Math.PI);
    }
    const looseStone=piece(cave,rock,0xb28c69,.09,.14,-tripStoneAt,.74,.42,.55);
    const caveLight=new T.PointLight(0xffc599,17,10,2);
    caveLight.position.set(-1.8,2.2,-3.6);cave.add(caveLight);
    cave.visible=false;
    const poseRunner=createRunner(scene);
    const beastFrame=new T.Group();scene.add(beastFrame);
    const posePursuer=createPursuer(beastFrame);
    const shadow=new T.Mesh(new T.CircleGeometry(1,20),new T.MeshBasicMaterial({color:0x29382d,transparent:true,opacity:.38,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;scene.add(shadow);
    const objects=new Map();
    function build(kind){
        const g=new T.Group();
        if(kind==='gem'){
            piece(g,gem,0xffbb3b,0,0,0,.58,.84,.58);
        }else if(kind==='hurdle'){
            piece(g,pole,0x775036,0,.29,0,.67,5.05,.67).rotation.z=Math.PI/2;
            piece(g,pole,0xbc9864,-1.05,.45,0,.20,.6,.20).rotation.z=.65;
        }else{
            const gate=kind==='gate',y=gate?1.46:.335;
            if(gate)for(const s of [-1,1])piece(g,box,0x60442f,s*.71,.92,0,.16,1.84,.34);
            piece(g,box,0x986348,0,y,0,1.56,.67,.45);
            for(const x of [-.46,0,.46])piece(g,box,0xf3bc66,x,y,.237,.24,.24,.045).rotation.z=Math.PI/4;
        }
        scene.add(g);return g;
    }
    const grip=new T.Group();scene.add(grip);
    piece(grip,box,0xe8b257,0,.22,0,.07,.44,.07);
    piece(grip,box,0xffd383,0,0,0,.72,.10,.13);
    const free={barrier:[],gate:[],gem:[],hurdle:[]};
    const shotPosition=new T.Vector3(),shotTarget=new T.Vector3(),shotDirection=new T.Vector3();
    let prevW=0,prevH=0,previousRatio=0;
    return function draw(state,distance,p,entities,t,menu,chase,course){
        const w=canvas.clientWidth,h=canvas.clientHeight;
        if(!w || !h)return;
        sprayTime.value=t;
        const ratio=renderPixelRatio(w,h);
        if(w!==prevW || h!==prevH || ratio!==previousRatio){
            renderer.setDrawingBufferSize(w,h,ratio);
            prevW=w;prevH=h;previousRatio=ratio;
        }
        const aspect=w/h, narrow=1-T.MathUtils.smoothstep(aspect,.65,1.12);
        const sway=Math.sin(t*.19)*.34;
        camera.fov=57+11*narrow;
        const verticalFov=T.MathUtils.degToRad(camera.fov);
        const chaseDepth=Math.max(5.35,2.65/(Math.tan(verticalFov/2)*aspect));
        camera.setViewOffset(w,h,-w*menu*(.22-.18*narrow),h*menu*narrow*.24,w,h);
        const catchFocus=chase.stumble*(1-menu);
        camera.position.set(T.MathUtils.lerp(p.x*.19,p.x+3.95,catchFocus)+(-1.25+sway*.45)*menu,
            2.36-.79*menu-.55*catchFocus,
            T.MathUtils.lerp(T.MathUtils.lerp(chaseDepth,3.85+narrow*.7,menu),2.05,catchFocus));
        camera.lookAt(p.x*(.16+.84*catchFocus),1.08-.47*catchFocus,-4.6+menu*3.7+5.36*catchFocus);
        const opening=state==='intro';
        cave.visible=course===courses[0] && !chase.completedDistance && (opening || (state==='playing' && distance<20));
        if(cave.visible){
            cave.position.z=chase.runIn+(opening?0:distance);
            const roll=opening?chase.stone:1;
            looseStone.position.set(.09+1.02*roll,.14+.18*Math.sin(Math.PI*roll),-tripStoneAt+.49*roll);
            looseStone.rotation.z=-2.65*roll;
        }
        if(opening){
            const focus=T.MathUtils.smoothstep(chase.intro,3.30,3.93);
            const follow=T.MathUtils.smoothstep(chase.intro,5.55,7.50);
            const trip=p.fallen+p.kneeling;
            camera.getWorldDirection(shotDirection).multiplyScalar(5).add(camera.position);
            // Follow the walk from the entrance, then cut in beside the waking head.
            shotPosition.set(-1.36-.30*trip,1.45,3.3+.8*narrow);
            shotPosition.lerp(shotTarget.set(-.50,1.02,chase.lead-.98),focus);
            camera.position.lerp(shotPosition,1-follow);
            shotTarget.set(.04+focus*1.40,.91-.44*trip*(1-focus),-.40+focus*(chase.lead+.41));
            camera.lookAt(shotDirection.lerp(shotTarget,1-follow));
        }
        const fallShot = p.fallen + p.kneeling;
        if(state==='playing' && fallShot>0){
            camera.getWorldDirection(shotDirection);
            shotDirection.multiplyScalar(5).add(camera.position);
            const side=p.lane<0 ? 1 : -1;
            camera.position.lerp(shotPosition.set(p.x+side*(2.35+narrow),1.75,1.65),fallShot);
            camera.lookAt(shotDirection.lerp(shotTarget.set(p.x-.16,.50,0),fallShot));
        }
        if(chase.hold>0 && state!=='start'){
            const closeUp=T.MathUtils.smoothstep(chase.hold,0,1.12);
            // Let the grab read in profile first, then fill the results
            // backdrop with the face while keeping the clasp in view.
            const portraitZoom=state==='over'?menu:0;
            camera.position.lerp(shotPosition.set(p.x+2.85-1.84*portraitZoom,
                1.45-.10*portraitZoom,-.46+.46*portraitZoom),closeUp);
            shotTarget.set(p.x,.87+.15*portraitZoom,1.16);
            camera.getWorldDirection(shotDirection);
            shotDirection.multiplyScalar(3.5).add(camera.position).lerp(shotTarget,closeUp);
            camera.lookAt(shotDirection);
        }
        const strideDistance=state==='intro' ? chase.runIn : chase.completedDistance+distance+(chase.runIn || 0);
        if(course!==activeCourse){
            for(const land of landscapes.values())land.visible=false;
            forest=landscapeFor(course);forest.position.set(0,0,0);forest.rotation.y=0;
            forest.visible=true;activeCourse=course;
        }
        forest.userData.approach.visible=!chase.completedDistance;
        const index=courses.indexOf(course);
        const previous=courses[(index+courses.length-1)%courses.length];
        const back=landscapes.get(previous);
        if(back){
            back.visible=chase.completedDistance>0 && distance<18;
            if(back.visible){
                const end=trackPoint(previous,previous.length),cs=Math.cos(end.heading),sn=Math.sin(end.heading);
                back.rotation.y=end.heading;back.position.set(-cs*end.x-sn*end.z,0,sn*end.x-cs*end.z);
            }
        }
        const nextCourse=courses[(index+1)%courses.length];
        const blend=T.MathUtils.smoothstep(distance,course.length-18,course.length);
        scene.fog.color.setHex(course.fog).lerp(paletteEnd.setHex(nextCourse.fog),blend);
        water.material.color.setHex(course.water).lerp(paletteEnd.setHex(nextCourse.water),blend);
        if(distance>course.length-65){
            const next=landscapeFor(nextCourse),end=trackPoint(course,course.length);
            next.visible=true;next.userData.approach.visible=false;
            next.position.set(end.x,0,end.z);next.rotation.y=-end.heading;
        }else if(landscapes.has(nextCourse))landscapes.get(nextCourse).visible=false;
        const origin=trackPoint(course,distance),cs=Math.cos(origin.heading),sn=Math.sin(origin.heading);
        route.rotation.y=origin.heading;
        route.position.set(-cs*origin.x-sn*origin.z,0,sn*origin.x-cs*origin.z);
        function place(obj,d,x,y){
            const point=routePoint(course,d,x),dx=point.x-origin.x,dz=point.z-origin.z;
            obj.position.set(cs*dx+sn*dz,y,-sn*dx+cs*dz);
            obj.rotation.y=origin.heading-point.heading;
        }
        const gripAt=p.riding?distance:course.cable.at;
        grip.visible=p.riding || distance<course.cable.at+1;
        place(grip,gripAt,course.cable.lane*1.55,cableHeight(course.cable,gripAt));
        const behind=.8+chase.lead;
        place(beastFrame,distance-behind,0,0);
        beastFrame.translateZ(-behind);
        const bite=posePursuer(state,p,t,chase);
        const runnerPosition=poseRunner(state,strideDistance,p,t,menu,chase.stumble,bite,chase.hold,chase.intro);
        shadow.position.set(runnerPosition.x,.018,.02+runnerPosition.z);shadow.scale.set(.37,.48,1);
        for(const [e,obj] of objects)if(!entities.includes(e)){obj.visible=false;free[e.kind].push(obj);objects.delete(e);}
        for(const e of entities){
            let obj=objects.get(e);
            if(!obj){obj=free[e.kind].pop()||build(e.kind);objects.set(e,obj);}
            obj.visible=true;place(obj,e.at,e.x,0);
            if(e.kind==='barrier'){
                const topple=e.struckAt===undefined ? 0 : T.MathUtils.smoothstep(t-e.struckAt,0,.30);
                obj.rotation.x=-1.55*topple;
                obj.position.y=.18*topple;
            }
            if(e.kind==='gem'){
                obj.rotation.y=t*2;
                obj.position.y=e.height+Math.sin(t*3+e.at)*.08;
            }
        }
        renderer.render(scene,camera);
    };
}
