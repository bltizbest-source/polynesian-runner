import * as T from './vendor/three.module.min.js';

// A continuous facial surface keeps the painted eyelids, nose and mouth
// registered as the animated head turns into profile.
function surface(columns,rows,sample){
    const positions=[],uv=[],indices=[],colors=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
        const u=i/columns,v=j/rows;
        const [x,y,z,color]=sample((u-.5)*Math.PI*2,v);
        positions.push(x,y,z);uv.push(u,v);
        if(color)colors.push(color.r,color.g,color.b);
        if(i && j){const n=j*(columns+1)+i;indices.push(n-columns-2,n-1,n,n-columns-2,n,n-columns-1);}
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    if(colors.length)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    g.setIndex(indices);g.computeVertexNormals();
    return g;
}
export function createNavigatorHead(neck){
    const texture=new T.TextureLoader().load('./assets/navigator-face.webp');
    texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
    // Follow the underside of the mandible back into the throat. Each station
    // gives height, half width, front and rear depth in the head's own space.
    const sections=[
        [0,.018,-.055,-.025],[.035,.053,-.084,.008],[.095,.073,-.095,.052],
        [.18,.087,-.101,.068],[.29,.100,-.101,.090],[.42,.111,-.103,.108],
        [.54,.114,-.100,.114],[.66,.111,-.101,.118],[.79,.106,-.097,.110],
        [.9,.086,-.084,.096],[1,.027,-.028,.052]
    ];
    const profile=new T.CatmullRomCurve3(sections.map(([,width,front,back])=>
        new T.Vector3(width,front,back)),false,'catmullrom',.38);
    function headSection(v){
        let i=0;
        while(i<sections.length-2 && v>sections[i+1][0])i++;
        const t=(v-sections[i][0])/(sections[i+1][0]-sections[i][0]);
        return profile.getPoint((i+t)/(sections.length-1));
    }
    const head=surface(72,54,(a,v)=>{
        const {x:width,y:front,z:back}=headSection(v);
        const cos=Math.cos(a),x=Math.sin(a)*width;
        const bulge=(cx,cy,rx,ry)=>Math.exp(-(((x-cx)/rx)**2+((v-cy)/ry)**2));
        const pair=(cx,cy,rx,ry)=>bulge(cx,cy,rx,ry)+bulge(-cx,cy,rx,ry);
        const relief=.023*bulge(0,.49,.017,.135)+.031*bulge(0,.38,.022,.061)
            +.014*pair(.022,.363,.013,.035)+.008*bulge(0,.247,.043,.038)
            +.008*bulge(0,.194,.040,.028)+.012*bulge(0,.12,.043,.065)
            +.014*pair(.070,.443,.034,.095)-.009*pair(.047,.532,.028,.051)
            +.008*pair(.046,.612,.038,.047);
        const z=(front+back)/2-(back-front)/2*Math.sign(cos)*Math.abs(cos)**.86
            -Math.max(0,cos)**2*relief;
        const y=v*.298-.012+.014*(1-v)**12+(.5-.5*cos)*.045*(1-v)**3;
        return [x,y,z];
    });
    const face=new T.Mesh(head,new T.MeshStandardMaterial({map:texture,roughness:.92}));
    face.castShadow=true;neck.add(face);

    const hairInk=new T.Color(0x282128),hairLight=new T.Color(0x554039);
    function hairSurface(a,v){
        const c=Math.cos(a),s=Math.sin(a),t=v*Math.PI*.5;
        const wave=Math.sin(13*a+6*v+1.9*Math.sin(3*a+3*v));
        const radius=Math.cos(t)**.66*(1+.022*wave);
        const line=.171+.072*c+.006*Math.sin(a*2+.5)-.010*Math.exp(-((a-.37)**2)/.045);
        const y=line+(.329-line)*Math.sin(t)+.0015*wave*radius;
        // Draw the short hairs in against the skull at the temples and nape.
        const edgeFit=1-T.MathUtils.smoothstep(v,0,.32);
        const h=headSection(T.MathUtils.clamp((y+.012)/.298,0,1));
        const hairX=s*(h.x+.002);
        const hairZ=(h.y+h.z)/2-((h.z-h.y)/2+.002)*Math.sign(c)*Math.abs(c)**.86;
        return [T.MathUtils.lerp(.121*s*radius+.007*v,hairX,edgeFit),y,
            T.MathUtils.lerp(.014-.128*c*radius+.028*v,hairZ,edgeFit),
            hairInk.clone().lerp(hairLight,(.5+.5*wave)*(.34+.32*v))];
    }
    const cap=surface(84,22,hairSurface);
    const hairMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.75,side:T.DoubleSide});
    const crown=new T.Mesh(cap,hairMat);crown.castShadow=true;neck.add(crown);
    // Swept tapered locks break the hairline and gather into the tied knot.
    const points=[],shades=[],triangles=[];
    for(let curl=0;curl<18;curl++){
        const start=(curl/18-.5)*Math.PI*2+.06*Math.sin(curl*7);
        const sweep=start<-.17?-1:1;
        for(let j=0;j<=13;j++)for(let k=0;k<=4;k++){
            const t=j/13, across=(k-2)/2, width=.135*(.10+.90*Math.sin(Math.PI*t)**.48);
            const angle=start+sweep*(.39*Math.sin(Math.PI*t)+.22*t)+across*width;
            const v=.014+.84*t;
            const [x,y,z]=hairSurface(angle,v);
            const ridge=(1-across*across)*Math.sin(Math.PI*t);
            const lift=.001+.009*ridge;
            points.push(x+Math.sin(angle)*lift,y+(.003+.007*t)*ridge,z-Math.cos(angle)*lift);
            const shade=hairInk.clone().lerp(hairLight,.12+ridge*.67);
            shades.push(shade.r,shade.g,shade.b);
            if(j && k){const n=points.length/3-1;triangles.push(n-6,n-1,n,n-6,n,n-5);}
        }
    }
    const locks=new T.BufferGeometry();
    locks.setAttribute('position',new T.Float32BufferAttribute(points,3));
    locks.setAttribute('color',new T.Float32BufferAttribute(shades,3));
    locks.setIndex(triangles);locks.computeVertexNormals();neck.add(new T.Mesh(locks,hairMat));
    const bun=new T.Group();bun.position.set(-.013,.296,.086);neck.add(bun);
    const coil=surface(52,18,(a,v)=>{
        const t=(v-.5)*Math.PI, wave=Math.sin(8*a+9*t);
        const r=Math.cos(t)*(1+.07*wave);
        return [.081*r*Math.sin(a),.077*Math.sin(t)+.015,.076*r*-Math.cos(a),
            hairInk.clone().lerp(hairLight,(.5+.5*wave)*.63)];
    });
    const knot=new T.Mesh(coil,hairMat);knot.castShadow=true;bun.add(knot);
    const binding=new T.Mesh(new T.TorusGeometry(.061,.007,6,24),new T.MeshStandardMaterial({color:0xcf9458,roughness:.85}));
    binding.rotation.x=Math.PI*.5;binding.position.y=-.032;bun.add(binding);
    return bun;
}
