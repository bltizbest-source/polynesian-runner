import * as T from './vendor/three.module.min.js';
import {paintedMaterial} from './character-material.js';

// An obsidian ridgeback with a heavy forequarter and a springing hind gait.
export function createPursuer(scene) {
    const hull=new T.SphereGeometry(1,18,12);
    const hide=paintedMaterial('ridgeback-hide',.82,1.25);
    const plate=paintedMaterial('ridgeback-horn',.56);
    const mouth=new T.MeshStandardMaterial({color:0x210f1b});
    const skull=plate.clone();skull.color.setHex(0xe9d1af);
    const nose=new T.MeshStandardMaterial({color:0x253039,roughness:.52});
    const tongue=new T.MeshStandardMaterial({color:0x704149,roughness:.64});
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
    // Loft anatomical cross-sections into one skin from the brisket to the
    // rump, and from the muzzle to the poll. Rows are z, center y, width, depth.
    function carved(parent,mat,rows){
        const center=new T.CatmullRomCurve3(rows.map(([z,y])=>new T.Vector3(0,y,z)),false,'catmullrom',.38);
        const radii=new T.CatmullRomCurve3(rows.map(([z,,x,y])=>new T.Vector3(x,y,z)),false,'catmullrom',.38);
        const pos=[],uv=[],indices=[],sides=28,steps=(rows.length-1)*3;
        for(let i=0;i<=steps;i++){
            const v=i/steps,c=center.getPoint(v),r=radii.getPoint(v);
            for(let j=0;j<=sides;j++){
                const a=j/sides*Math.PI*2;
                pos.push(c.x+Math.sin(a)*r.x,c.y+Math.cos(a)*r.y,c.z);
                uv.push(j/sides,v);
                if(i && j){const n=i*(sides+1)+j;indices.push(n-sides-2,n-1,n,n-sides-2,n,n-sides-1);}
            }
        }
        const geo=new T.BufferGeometry();
        geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
        geo.setIndex(indices);geo.computeVertexNormals();
        const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;parent.add(mesh);return mesh;
    }
    const root=pivot(scene),body=pivot(root),head=pivot(body,0,.69,-.49);
    carved(body,hide,[[-.68,.69,.085,.12],[-.57,.72,.27,.25],[-.37,.70,.38,.36],
        [-.16,.66,.37,.34],[.08,.63,.30,.255],[.25,.65,.255,.20],[.43,.65,.31,.255],
        [.57,.61,.26,.23],[.69,.60,.10,.12]]);
    carved(head,hide,[[-.65,.054,.11,.068],[-.57,.063,.166,.096],[-.41,.081,.18,.113],
        [-.32,.108,.226,.149],[-.21,.123,.292,.198],[-.095,.119,.309,.212],
        [.024,.084,.265,.18],[.158,.03,.177,.158]]);
    form(head,hull,nose,0,.07,-.632,.137,.077,.068);
    const jaw=pivot(head,0,-.01,-.17);
    carved(jaw,hide,[[-.449,-.074,.088,.042],[-.38,-.077,.153,.061],[-.23,-.093,.176,.065],
        [-.08,-.076,.179,.084],[.05,-.028,.135,.085]]);
    form(jaw,hull,mouth,0,-.039,-.21,.16,.038,.226);
    form(jaw,hull,tongue,0,-.007,-.224,.086,.013,.137);
    const bite=pivot(head,0,-.038,-.49),bitePosition=new T.Vector3();
    const eyes=[],ears=[];
    for(const s of [-1,1]){
        const socket=pivot(head,s*.178,.149,-.318);
        socket.rotation.y=-s*.77;socket.rotation.z=s*.16;
        form(socket,hull,nose,0,0,0,.085,.048,.037);
        const lid=pivot(socket,0,-.001,-.026);eyes.push(lid);
        form(lid,hull,ember,0,0,0,.050,.024,.018);
        form(lid,hull,mouth,s*.004,0,-.017,.009,.017,.0035);
        form(lid,hull,ivory,-.014,.009,-.016,.005,.005,.003);
        hook(head,skull,[s*.095,.203,-.382],[s*.192,.244,-.322],[s*.294,.214,-.14],.052);
        form(head,hull,mouth,s*.073,.092,-.687,.035,.021,.011);
        hook(head,skull,[s*.204,.25,-.07],[s*.53,.31,.11],[s*.45,.56,.38],.099);
        const ear=pivot(head,s*.237,.194,.034);ears.push(ear);
        hook(ear,hide,[0,0,0],[s*.078,.06,.045],[s*.119,.153,.116],.061);
        hook(head,plate,[s*.212,.064,-.16],[s*.39,.068,-.04],[s*.409,.142,.167],.063);
        hook(head,ivory,[s*.14,.005,-.492],[s*.163,-.099,-.506],[s*.15,-.149,-.456],.031);
        for(let j=0;j<4;j++){
            const z=-.26-j*.057;
            hook(head,ivory,[s*.147,-.008,z],[s*.155,-.045,z-.006],[s*.146,-.070,z+.009],.015);
            hook(jaw,ivory,[s*.138,-.048,z+.15],[s*.143,-.020,z+.15],[s*.14,.002,z+.14],.013);
        }
    }
    // Broad, swept keratin blades with small amber seams at their roots.
    for(let i=0;i<8;i++){
        const z=-.42+i*.134,h=.31-.023*i,y=[1.00,1.035,1.01,.975,.913,.859,.832,.808][i];
        const blade=carved(body,plate,[[0,0,.058,.016],[.037,h*.32,.069,h*.34],
            [.102,h*.6,.044,h*.38],[.167,h*.85,.021,h*.20],[.193,h,.002,.003]]);
        blade.position.set(0,y,z);
        for(const s of [-1,1]){
            const scute=carved(body,plate,[[0,0,.018,.011],[.032,.018,.065,.028],
                [.089,.025,.073,.032],[.151,.045,.047,.022],[.19,.059,.004,.005]]);
            scute.position.set(s*(.29-.009*i),y-.153,z);scute.rotation.z=-s*.65;
        }
        form(body,hull,ember,0,y+.011,z+.034,.040,.010,.058);
    }
    const tailBase=pivot(body,0,.60,.53);
    carved(tailBase,hide,[[0,0,.145,.143],[.14,.012,.134,.118],[.29,.043,.107,.087],[.44,.058,.077,.063]]);
    const tip=pivot(tailBase,0,.058,.415);
    carved(tip,plate,[[0,0,.081,.064],[.14,.019,.059,.048],[.27,.066,.036,.031],[.41,.135,.002,.002]]);
    const legs=[];
    for(const s of [-1,1])for(const rear of [false,true]){
        // The hind knee points forward and folds into a raised hock. The
        // foreleg carries the chest over a straighter, weight-bearing wrist.
        const hip=pivot(body,s*(rear?.241:.270),rear?.635:.714,rear?.415:-.321);
        const kneeY=rear?.267:.325,kneeZ=rear?-.123:.077;
        const upper=carved(hip,hide,[[0,0,.084,.096],[.060,rear?-.024:.014,.129,.139],
            [.135,rear?-.060:.028,.137,rear?.146:.123],[.206,rear?-.105:.05,.106,.104],
            [kneeY,kneeZ,.070,.069]]);
        upper.rotation.x=Math.PI/2;
        const ankle=pivot(hip,0,-kneeY,kneeZ);
        const length=rear?.286:.298,offset=rear?.169:-.064;
        const lower=carved(ankle,hide,[[0,0,.074,.079],[.055,rear?.028:.005,.079,.084],
            [.14,rear?.097:-.019,.062,.062],[length-.047,offset+(rear?.026:.011),.046,.058],
            [length,offset,.047,.045]]);
        lower.rotation.x=Math.PI/2;
        const paw=pivot(ankle,0,-length,offset);
        carved(paw,hide,[[-.167,-.060,.034,.023],[-.131,-.058,.080,.036],
            [-.077,-.046,.085,.048],[-.023,-.029,.060,.058],[.018,-.009,.044,.041]]);
        for(let j=-1;j<=1;j++){
            const x=j*.045,z=-.142+.016*Math.abs(j);
            form(paw,hull,plate,x,-.060,z,.037,.029,.051);
            hook(paw,ivory,[x,-.058,z-.030],[x,-.068,z-.066],[x,-.080,z-.077],.013);
        }
        legs.push({hip,ankle,paw,s,rear});
    }
    // Teeth, claws and scales move with their parent joint. Batch these
    // rigid pieces once so detail doesn't add a draw call for every scale.
    root.traverse(joint=>{
        if(!joint.isGroup)return;
        const byMaterial=new Map();
        for(const part of joint.children.filter(child=>child.isMesh)){
            const group=byMaterial.get(part.material)||[];
            group.push(part);byMaterial.set(part.material,group);
        }
        for(const [mat,parts] of byMaterial){
            if(parts.length<2)continue;
            const attrs={position:[],normal:[],uv:[]};
            for(const part of parts){
                part.updateMatrix();
                const g=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();
                g.applyMatrix4(part.matrix);
                for(const name of Object.keys(attrs)){
                    const values=g.getAttribute(name).array;
                    for(const value of values)attrs[name].push(value);
                }
                g.dispose();joint.remove(part);
            }
            const g=new T.BufferGeometry();
            for(const [name,values] of Object.entries(attrs))
                g.setAttribute(name,new T.Float32BufferAttribute(values,name==='uv'?2:3));
            const batch=new T.Mesh(g,mat);batch.castShadow=true;joint.add(batch);
        }
    });
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
        const blink=1-.91*Math.max(0,Math.cos(t*1.7+.8))**100;
        for(const eye of eyes)eye.scale.y=Math.max(.012,awake*blink);
        ears.forEach((ear,i)=>{ear.rotation.x=-.64*(1-awake)+.13*Math.sin(t*2.4+i)*awake;});
        const phase=chase.stride*2.28;
        const lunge=state==='catching'?Math.sin(Math.PI*Math.max(0,1-chase.lead/.85)):0;
        const pinned=state==='over'||chase.lead===0;
        body.position.y=-.19*(1-awake)+run*.081*Math.abs(Math.sin(phase))+.013*Math.sin(t*3)+lunge*.19;
        body.rotation.x=.09*Math.sin(phase)*run+lunge*.24-(pinned?.19:0)+hoist*.36;
        head.rotation.x=.1*Math.cos(phase+.5)*run-.07-(pinned?.24:0)+hoist*.63;
        head.rotation.z=hoist*(.13+.075*Math.sin(t*6));
        jaw.rotation.x=-(.14+.075*Math.sin(phase)+lunge*.51)*(1-grip)-.055*grip;
        if(opening){
            head.rotation.x+=.66*(1-awake)-.24*awake*(1-run);
            jaw.rotation.x*=awake;
            const snap=Math.sin(Math.PI*T.MathUtils.smoothstep(chase.intro,3.5,5.65));
            jaw.rotation.x-=.57*snap;
            head.rotation.x-=.14*snap;
        }
        tailBase.rotation.y=.74*(1-awake)+awake*.34*Math.sin(t*4.1);tip.rotation.y=.60*(1-awake)+awake*.37*Math.sin(t*4.1-.8);
        for(const {hip,ankle,paw,s,rear} of legs){
            const swing=Math.sin(phase+(rear?2.9:0)+s*.51);
            hip.rotation.x=swing*.72*run+(rear?-.72:.68)*(1-awake);
            ankle.rotation.x=-.19-Math.max(0,swing)*.78*run;
            paw.rotation.x=-(hip.rotation.x+ankle.rotation.x)*(.66+.18*Math.cos(phase));
        }
        return grip>0 ? bite.getWorldPosition(bitePosition) : null;
    };
}
