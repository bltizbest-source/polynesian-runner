import * as T from './vendor/three.module.min.js';
import {createRunner} from './runner.js';
import {createPursuer} from './pursuer.js';

// Static scenery is batched by shape. One repeating section carries the whole forest.
export function createTempleScene(canvas) {
    const renderer = new T.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
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
    // A ridged, tapering leaf catches light on both sides of its midrib.
    const leaf=new T.BufferGeometry();
    leaf.setAttribute('position',new T.Float32BufferAttribute([
        0,0,0, -.47,.18,.44, 0,.32,.48, 0,0,0, 0,.32,.48,.47,.18,.44,
        -.47,.18,.44,0,-.13,1,0,.32,.48, 0,.32,.48,0,-.13,1,.47,.18,.44
    ],3));leaf.computeVertexNormals();
    const leaves=mat.clone();leaves.side=T.DoubleSide;
    const forest=new T.Group();scene.add(forest);
    const batches=new Map(), temp=new T.Object3D();
    function put(shape,color,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0) {
        temp.position.set(x,y,z);temp.scale.set(sx,sy,sz);temp.rotation.set(rx,ry,rz,'YXZ');temp.updateMatrix();
        if(!batches.has(shape))batches.set(shape,[]);
        batches.get(shape).push([temp.matrix.clone(),new T.Color(color)]);
    }
    let seed=8925;
    function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    const basalt=[0x536359,0x77806b,0x667565,0x899078], paving=[0x908c72,0xa29d80,0x7c8370,0x98967e];
    const green=[0x346748,0x4f8050,0x628d4d,0x235c49,0x7b9c4d];
    const pick=colors=>colors[Math.floor(random()*colors.length)];
    function palm(x,z,height) {
        const tilt=(random()-.5)*.22;
        put(pole,0x695b40,x,height*.46-.7,z,.43,height,.43,0,0,tilt);
        for(let i=0;i<10;i++){
            put(leaf,pick(green),x-height*.48*Math.sin(tilt),height*.96-.7,z,1.15+random(),2,2.2+random()*2,(random()-.45)*.58,i*.628+tilt);
        }
    }
    function shrine(x,z,side) {
        // Stepped stone guardian, recessed eyes, projecting brow, nose and jaw.
        const stones=0x78816c, trim=0xb3a379;
        put(box,0x596956,x,.28,z,2.35,.66,2.15);
        put(box,stones,x,1.65,z,1.72,2.25,1.53);
        put(box,0x697661,x,3.15,z,1.94,1.14,1.72);
        put(box,stones,x,4.11,z,1.86,1.12,1.61);
        put(box,0x85926c,x,4.83,z,2.12,.32,1.94);
        put(box,0x507242,x,5.03,z,1.94,.16,1.8);
        for(const s of [-1,1]){
            put(box,0x354c41,x+s*.5,3.73,z+.85,.75,.27,.16);
            put(box,trim,x+s*.48,3.99,z+.89,.94,.28,.28,0,0,s*.19);
            put(box,0x999578,x+s*.67,3.23,z+.88,.34,.64,.21,0,0,-s*.22);
        }
        put(box,trim,x,3.52,z+.98,.32,.71,.36);
        put(box,0x3e5144,x,2.97,z+.83,.76,.17,.16);
        for(let i=0;i<4;i++)put(box,i%2?stones:trim,x,1.03+i*.35,z+.785,.78-i*.1,.12,.11,0,0,side*.35);
    }
    const period=96;
    for(let j=0;j<period;j++){
        const z=12-j;
        for(let lane=-1;lane<=1;lane++){
            put(box,pick(paving),lane*1.58,-.19+random()*.012,z,1.555,.38,.975);
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
            if(j%5===0)palm(s*(5.1+random()*4.5),z,4.1+random()*4);
            if(j%7===0){
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
        if(j%32===25){
            for(const s of [-1,1])shrine(3.42*s,z,s);
            put(box,0x687663,0,5.31,z,8.78,.48,1.88);
            put(box,0xaa9b76,0,5.6,z,9.08,.17,1.99);
            put(box,0x647d50,0,5.79,z,8.62,.23,1.84);
            for(let i=-5;i<=5;i++)put(box,0xc0a474,i*.62,5.33,z+.957,.22,.22,.06,0,0,.785);
            for(let v=0;v<10;v++){
                const x=(random()-.5)*8,len=.3+random()*1.15;
                put(pole,0x517249,x,5.75-len/2,z+.99,.065,len,.065);
                put(leaf,pick(green),x,5.8-len,z+.99,.24,.35,.44,.78,v);
            }
        }
    }
    for(const [shape,instances] of batches){
        const mesh=new T.InstancedMesh(shape,shape===leaf?leaves:mat,instances.length);
        mesh.castShadow=true;mesh.receiveShadow=true;
        instances.forEach(([matrix,color],i)=>{mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color);});
        forest.add(mesh);
    }
    const repeat=forest.clone();scene.add(repeat);
    const materials=new Map();
    function piece(parent,shape,color,x,y,z,sx,sy,sz) {
        if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,flatShading:true}));
        const obj=new T.Mesh(shape,materials.get(color));
        obj.castShadow=true;obj.receiveShadow=true;
        obj.position.set(x,y,z);obj.scale.set(sx,sy,sz);parent.add(obj);return obj;
    }
    const water=piece(scene,box,0x358888,0,-1.03,-56,300,.25,260);water.castShadow=false;
    for(let i=0;i<12;i++)piece(scene,rock,0x688575,(i-5)*17,-.8,-85-random()*20,27,12+random()*21,26);
    const poseRunner=createRunner(scene);
    const posePursuer=createPursuer(scene);
    const shadow=new T.Mesh(new T.CircleGeometry(1,20),new T.MeshBasicMaterial({color:0x29382d,transparent:true,opacity:.38,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;scene.add(shadow);
    const objects=new Map();
    function build(kind){
        const g=new T.Group();
        if(kind==='gem'){
            piece(g,gem,0xffbb3b,0,1.12,0,.58,.84,.58);
        }else{
            const gate=kind==='gate',y=gate?1.46:.335;
            if(gate)for(const s of [-1,1])piece(g,box,0x60442f,s*.71,.92,0,.16,1.84,.34);
            piece(g,box,0x986348,0,y,0,1.56,.67,.45);
            for(const x of [-.46,0,.46])piece(g,box,0xf3bc66,x,y,.237,.24,.24,.045).rotation.z=Math.PI/4;
        }
        scene.add(g);return g;
    }
    const free={barrier:[],gate:[],gem:[]};
    let prevW=0,prevH=0;
    return function draw(state,distance,p,entities,t,menu,chase){
        const w=canvas.clientWidth,h=canvas.clientHeight;
        if(!w || !h)return;
        if(w!==prevW||h!==prevH){
            renderer.setPixelRatio(Math.min(devicePixelRatio,1.75,Math.sqrt(3200000/(w*h))));
            renderer.setSize(w,h,false);prevW=w;prevH=h;
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
        forest.position.z=distance%period;repeat.position.z=forest.position.z-period;
        poseRunner(state,distance,p,t,menu,chase.stumble);
        posePursuer(state,p,t,chase);
        shadow.position.set(p.x,.018,.02+chase.stumble*.48);shadow.scale.set(.37,.48,1);
        for(const [e,obj] of objects)if(!entities.includes(e)){obj.visible=false;free[e.kind].push(obj);objects.delete(e);}
        for(const e of entities){
            let obj=objects.get(e);
            if(!obj){obj=free[e.kind].pop()||build(e.kind);objects.set(e,obj);}
            obj.visible=true;obj.position.set(e.x,0,distance-e.at);
            if(e.kind==='gem'){obj.rotation.y=t*2;obj.position.y=Math.sin(t*3+e.at)*.08;}
        }
        renderer.render(scene,camera);
    };
}
