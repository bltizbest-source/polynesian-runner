import {courses,trackPoint,routePoint,cableHeight,viewPoint,openSpan} from './courses.js';
import {renderPixelRatio} from './viewport.js';
import * as T from './vendor/three.module.min.js';
import {caveFaces,tripStoneAt} from './cave.js';
import {paintedFlora,palmFrond,coastalStone,trailMaterial,waterMaterial} from './island-art.js';
import {createRunner} from './runner.js';
import {createPursuer} from './pursuer.js';

// Each course is built once. Its static scenery shares instanced geometry.
export function createTempleScene(canvas) {
    const renderer = new T.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=T.PCFSoftShadowMap;
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(58,1,.1,160);
    scene.background=new T.Color(0xd0bc87);
    scene.fog=new T.FogExp2(0xabc4a4,.020);
    const loader=new T.TextureLoader();
    const horizonReady={value:0};
    const horizon=loader.load('./assets/island-horizon.webp',()=>{horizonReady.value=1;});
    horizon.colorSpace=T.SRGBColorSpace;horizon.wrapS=T.MirroredRepeatWrapping;
    scene.add(new T.HemisphereLight(0xffeade,0x88a5a1,1.66));
    const sun=new T.DirectionalLight(0xffdfb1,2.24);
    sun.position.set(-11,19,1);sun.target.position.set(0,0,-11);
    sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
    Object.assign(sun.shadow.camera,{left:-17,right:17,top:17,bottom:-17,near:.2,far:59});
    sun.shadow.normalBias=.027;sun.shadow.bias=-.0003;
    scene.add(sun,sun.target);
    const sky=new T.Mesh(new T.SphereGeometry(145,24,12),new T.ShaderMaterial({
        side:T.BackSide,depthWrite:false, uniforms:{paint:{value:horizon},ready:horizonReady},
        vertexShader:'varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:`uniform sampler2D paint;uniform float ready;varying vec3 v; void main(){vec3 d=normalize(v);
            float h=smoothstep(-.02,.65,d.y),s=dot(d,normalize(vec3(-.42,.42,-1.)));
            vec3 col=mix(vec3(.82,.85,.71),vec3(.35,.68,.71),h);
            col+=vec3(.28,.17,.02)*pow(max(s,0.),18.);
            col=mix(col,vec3(1.,.92,.68),smoothstep(.992,.995,s));vec2 uv=vec2(.5+atan(d.x,-d.z)/1.85,clamp(.12+d.y*1.03,0.,1.));
            gl_FragColor=vec4(mix(col,texture2D(paint,uv).rgb,ready),1.);
            #include <colorspace_fragment>
            }`
    }));
    scene.add(sky);
    const box=new T.BoxGeometry(), rock=coastalStone(), gem=new T.LatheGeometry([[0,-.52],[.39,-.09],[.44,.08],[.24,.35],[.055,.42],[0,.42]].map(([r,y])=>new T.Vector2(r,y)),8);
    const flame=new T.LatheGeometry([[.02,-.45],[.28,-.35],[.36,-.12],[.25,.12],[.12,.29],[.012,.50]]
        .map(([r,y])=>new T.Vector2(r,y)),10);
    const ember=flame.attributes.position;
    for(let i=0;i<ember.count;i++)ember.setX(i,ember.getX(i)+.19*(ember.getY(i)+.45)**2);
    const glow=new T.MeshBasicMaterial();
    const pole=new T.CylinderGeometry(.43,.53,1,12), cone=new T.ConeGeometry(.5,1,7);
    const mat=new T.MeshStandardMaterial({roughness:.93});
    const stoneMaterial=mat.clone();stoneMaterial.vertexColors=true;
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
    const flora=paintedFlora(loader), frond=palmFrond(), trunk=new T.CylinderGeometry(.42,.54,1,10,5);
    const trunkVertices=trunk.attributes.position;
    for(let i=0;i<trunkVertices.count;i++){
        const h=trunkVertices.getY(i)+.5;
        trunkVertices.setX(i,trunkVertices.getX(i)+1.6*h*h);
    }
    trunk.computeVertexNormals();
    const trail=new T.BoxGeometry(),paintedTrail=trailMaterial(loader);
    const roof=new T.SphereGeometry(.5,18,8,0,Math.PI*2,0,Math.PI*.52);
    function buildLandscape(course) {
        const forest=new T.Group();scene.add(forest);
        const approach=new T.Group();forest.add(approach);
        forest.userData.approach=approach;
        const entranceBatches=new Map(), courseBatches=new Map(), temp=new T.Object3D();
        let batches=entranceBatches;
        const limits=[-36,...course.turns.map(([at])=>at),course.length];
        const segments=limits.slice(1).map((end,i)=>{
            const start=limits[i],p=trackPoint(course,start),q=trackPoint(course,end);
            return {start,end,p,dx:(q.x-p.x)/(end-start),dz:(q.z-p.z)/(end-start)};
        });
        function put(shape,color,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,along=0) {
            const at=trackPoint(course,-z),cs=Math.cos(at.heading),sn=Math.sin(at.heading);
            const wx=at.x+cs*x+sn*along,wz=at.z+sn*x-cs*along;
            // Keep scenery from the approach off the perpendicular exit lane.
            if(Math.abs(x)>3 && y+sy/2>0 && segments.some(({start,end,p,dx,dz})=>{
                if(-z>=start && -z<=end)return false;
                const u=wx-p.x,v=wz-p.z;
                const nearest=Math.max(0,Math.min(end-start,u*dx+v*dz));
                return Math.hypot(u-nearest*dx,v-nearest*dz)<2.75+Math.max(sx,sz)*.5;
            }))return;
            temp.position.set(wx,y,wz);temp.scale.set(sx,sy,sz);temp.rotation.set(rx,ry-at.heading,rz,'YXZ');temp.updateMatrix();
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
            put(trunk,0x967151,x,height*.5-.73,z,.40,height,.42,0,0,tilt);
            const crown=x+.64-height*.50*Math.sin(tilt);
            for(let i=0;i<9;i++)
                put(frond.geo,pick(green),crown,height-.72,z,.98+random()*.64,2.6,2.8+random()*1.3,(random()-.55)*.58,i*.698+tilt);

        }
        const [lagoon,lava,fern,cliffs,plains,falls]=courses.map(c=>c===course);
        for(let j=-36;j<course.length;j++){
            if(j===0)batches=courseBatches;
            if(openSpan(course,j))continue;
            if(course.turns.some(([at])=>Math.abs(j-at)<=2))continue;
            const z=-j;
            put(trail,paving[1],0,-.19,z,4.96,.38,1.005);
            for(const s of [-1,1]){
                const x=s*2.55;
                put(rock,pick(basalt),x,-.22,z,.65,.57,1.26,0,.08*Math.sin(j));
                if(j%4===0){
                    put(rock,0x637b53,s*(8.3+random()*2),-1.3,z,8,2.6,7.2);
                    put(box,0xa6bc98,s*(3.9+random()*1.3),-.894,z,.8+random(),.01,.045);
                    put(rock,pick(basalt),s*(4+random()*5),-.58,z,2+random()*2,1.6,2.3);
                    const fx=s*(3.1+random()*1.5);
                    if(j%8===0){
                        const size=.85+random()*.44, shrub=lava || plains?3:2;
                        put(flora.shapes[shrub],0xf1ebd8,fx,-.38,z,2.6*size,1.32*size,1);
                    }
                }
                if(j%7===0){
                    const x=s*(5.1+random()*4.5);
                    if(lagoon){
                        const h=4.4+random()*3;
                        if(j%21===0)palm(x,z,h);
                        else put(flora.shapes[0],0xfff7e2,x,-.54,z,h*.77,h,1);
                        put(rock,0x8c9562,x,-1.03,z,4.9,1.2,3.9);
                    }
                    else if(lava){
                        put(rock,0x48404a,x,.3,z,3,3.6,3.7);
                        put(box,0xe87638,x,.12,z+1.7,2,.06,.15,0,.32);
                        if(j%21===0)put(cone,0x513f47,x*2.4,2,z,12,9,12);
                    }else if(fern){
                        put(pole,0x594b3b,x,1.5,z,.3,3,.3);
                        for(let k=0;k<12;k++)
                            put(frond.geo,k%2?0x99bc89:0x648b6a,x,2.9,z,.58,1.3,2.8,-.3,k*.524);
                    }else if(cliffs){
                        put(rock,0x948679,x,-.55,z,6,3.4,5.8);
                        if(j%21===0){
                            for(let k=0;k<7;k++){
                                const height=1.8+2*Math.sin(k*.97)**2;
                                put(spray,k%2?0xc5e9e5:0xe3f4ea,x+Math.sin(k)*.38,height*.5,z+Math.cos(k)*.33,.36,height,.38,0,0,Math.sin(k)*.22);
                            }
                        }
                    }else if(plains){
                        put(rock,0x919049,x,-.3,z,9,2.1,8);
                        for(let k=0;k<5;k++)put(leaf,k%2?0xc6ae5e:0xb59a49,x+Math.sin(k),.6,z+Math.cos(k),.26,1,1.6,-1.15,k);
                        if(j%21===0)put(rock,0x77604f,x*2,.7,z,7,4.2,9);
                    }else if(falls){
                        const height=7+random()*5;
                        put(rock,0x466352,x*1.4,height*.36,z,8,height,9);
                        if(j%21===0){
                            for(let k=-1;k<=1;k++)put(box,k?0x9ed3d0:0xe0ece0,x*1.4-s*2.9,height*.32,z+k*.48,.3,height*.72,.52,0,0,-s*.13);
                            put(rock,0xccdfd3,x*1.4-s*3.4,-.2,z,2.4,.7,2.8);
                        }
                    }
                }
                if((lagoon || fern || falls) && j%11===0){
                    const tx=s*(10+random()*10), ht=5+random()*7;
                    put(rock,0x799065,tx,-1.10,z,8,1.55,7);
                    put(flora.shapes[1],0xe5efdc,tx,-.43,z,ht*1.23,ht,1);
                }
                if(j%20===6){
                    put(pole,0x534d39,x,.72,z,.18,1.6,.18);
                    put(pole,0xbc965b,x,1.44,z,.35,.25,.35);
                    put(flame,0xff8b40,x,1.85,z,.32,.84,.32);
                    put(flame,0xffdf83,x,1.89,z+.08,.19,.55,.19);
                }
            }
            if(lagoon && j%36===14){
                const x=7;
                put(box,0xa68159,x,.3,z,4.4,.35,3.2);
                for(const sx of [-1,1])for(const sz of [-1,1])
                    put(pole,0x835c3c,x+sx*1.55,1.35,z+sz, .18,2,.18);
                put(roof,0xbf8d52,x,2.28,z,5.5,3.1,4.5);
                put(pole,0x997048,x,2.24,z,5.55,.17,4.58);
            }
        }
        for(const [at,dir] of course.turns){
            const x=-dir*2.85,z=3-at;
            // Fill the shared 5 m square once. Its two open sides connect the legs.
            put(trail,paving[1],0,-.19,-at,5,.38,5);
            put(box,pick(basalt),-dir*2.55,-.16,-at,.37,.47,5.49);
            put(box,pick(basalt),0,-.16,-at,5.45,.47,.37,0,0,0,2.55);
            put(pole,0x795537,x,.85,z,.15,1.7,.15);
            put(box,0x283c32,x,1.62,z,1.32,.72,.15);
            for(const offset of [-.24,.16])for(const side of [-1,1]){
                put(box,0xffd174,x+offset,1.62+side*.105,z+.10,.38,.09,.06,0,0,-dir*side*.65);
            }
        }
        for(const at of [...course.gaps.map(g=>g-2),course.cable.at+1]){
            put(box,0xe3ba79,0,.016,-at-.36,4.72,.035,.16);
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
        const surfaces=new Map([[rock,stoneMaterial],[frond.geo,frond.mat],[trail,paintedTrail],[leaf,leaves],[spray,foam],[flame,glow],
            ...flora.shapes.map(shape=>[shape,flora.mat])]);
        for(const [group,parts] of [[approach,entranceBatches],[forest,courseBatches]])for(const [shape,instances] of parts){
            const mesh=new T.InstancedMesh(shape,surfaces.get(shape)||mat,instances.length);
            mesh.castShadow=shape!==spray && shape!==frond.geo && !flora.shapes.includes(shape);mesh.receiveShadow=true;
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
        if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.84}));
        const obj=new T.Mesh(shape,materials.get(color));
        obj.castShadow=true;obj.receiveShadow=true;
        obj.position.set(x,y,z);obj.scale.set(sx,sy,sz);parent.add(obj);return obj;
    }
    const ripples=waterMaterial(sprayTime);
    const water=new T.Mesh(box,ripples.mat);water.scale.set(320,.25,310);water.position.set(0,-1.03,-56);water.receiveShadow=true;scene.add(water);

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
    const penumbra=document.createElement('canvas');penumbra.width=penumbra.height=64;
    const ink=penumbra.getContext('2d'),radial=ink.createRadialGradient(32,32,2,32,32,31);
    radial.addColorStop(0,'white');radial.addColorStop(.52,'#ffffffbb');radial.addColorStop(1,'#ffffff00');
    ink.fillStyle=radial;ink.fillRect(0,0,64,64);shadow.material.map=new T.CanvasTexture(penumbra);
    shadow.rotation.x=-Math.PI/2;scene.add(shadow);
    const objects=new Map();
    function build(kind){
        const g=new T.Group();
        if(kind==='gem'){
            const jewel=piece(g,gem,0xffbb3b,0,0,0,.65,.86,.65);
            Object.assign(jewel.material,{roughness:.28,metalness:.24,flatShading:true});
            jewel.material.emissive.setHex(0x71410a);
        }else if(kind==='hurdle'){
            piece(g,pole,0x775036,0,.29,0,.67,5.05,.67).rotation.z=Math.PI/2;
            piece(g,pole,0xbc9864,-1.05,.45,0,.20,.6,.20).rotation.z=.65;
        }else{
            const gate=kind==='gate',y=gate?1.46:.335;
            if(gate)for(const s of [-1,1])piece(g,pole,0x654936,s*.71,.92,0,.18,1.84,.18);
            for(const dy of [-.15,.13]){
                piece(g,pole,0x995c38,0,y+dy,0,.36,1.58,.36).rotation.z=Math.PI/2;
                for(const side of [-1,1]){
                    piece(g,pole,0xefc990,side*.59,y+dy,0,.38,.075,.38).rotation.z=Math.PI/2;
                }
            }
            piece(g,box,0xe9b26b,0,y,.17,.18,.18,.04).rotation.z=Math.PI/4;
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
        if(state==='playing' && p.impact){
            const fallShot=Math.sin(Math.PI*p.impact.phase)**2;
            camera.getWorldDirection(shotDirection);
            shotDirection.multiplyScalar(5).add(camera.position);
            const side=p.lane<0 ? 1 : -1;
            camera.position.lerp(shotPosition.set(p.x+side*(1.65+.4*narrow),1.9,chaseDepth-.75),fallShot);
            camera.lookAt(shotDirection.lerp(shotTarget.set(p.x-.16,.50,0),fallShot));
        }
        if(p.drop){
            const follow=T.MathUtils.smoothstep(p.drop.phase,0,.9)*(1-menu);
            camera.position.y-=.48*follow;
            camera.getWorldDirection(shotDirection).multiplyScalar(5).add(camera.position);
            camera.lookAt(shotDirection.lerp(shotTarget.set(p.x,Math.max(-2.1,p.y+.62),0),follow*.85));
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
        const origin=viewPoint(course,distance,chase,p),cs=Math.cos(origin.heading),sn=Math.sin(origin.heading);
        sky.rotation.y=origin.heading;
        ripples.origin.value.set(origin.x,origin.z);ripples.heading.value.set(cs,sn);
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
        beastFrame.visible=!chase.failure && !openSpan(course,distance-behind);
        place(beastFrame,distance-behind,chase.x,0);
        beastFrame.translateX(-chase.x);
        beastFrame.translateZ(-behind);
        const bite=posePursuer(state,p,t,chase);
        const runnerPosition=poseRunner(state,strideDistance,p,t,menu,chase.stumble,bite,chase.hold,chase.intro);
        shadow.visible=!openSpan(course,distance) && !chase.failure;
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
