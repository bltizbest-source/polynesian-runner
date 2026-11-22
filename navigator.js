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
    const head=surface(48,34,(a,v)=>{
        const sin=Math.sin(a),cos=Math.cos(a);
        const jaw=T.MathUtils.smoothstep(v,-.07,.34);
        const width=.061+.051*jaw+.005*Math.sin(Math.PI*v);
        const crown=1-.66*T.MathUtils.smoothstep(v,.71,1);
        const x=sin*width*crown;
        const front=Math.max(0,cos);
        const bulge=(cx,cy,rx,ry)=>Math.exp(-(((x-cx)/rx)**2+((v-cy)/ry)**2));
        const sculpt=.022*bulge(0,.52,.015,.13)+.032*bulge(0,.365,.023,.066)
            +.012*bulge(.021,.345,.014,.044)+.012*bulge(-.021,.345,.014,.044)
            +.010*bulge(0,.22,.041,.06)+.012*bulge(0,.08,.046,.08)
            +.009*bulge(.066,.43,.031,.12)+.009*bulge(-.066,.43,.031,.12)
            -.008*bulge(.044,.55,.026,.055)-.008*bulge(-.044,.55,.026,.055);
        const z=.004-.104*Math.sign(cos)*Math.abs(cos)**.73*(.67+.33*jaw)*crown-front**3*sculpt;
        return [x,v*.298-.012+Math.max(0,-cos)*.062*(1-v)**2,z];
    });
    const face=new T.Mesh(head,new T.MeshStandardMaterial({map:texture,roughness:.92}));
    face.castShadow=true;neck.add(face);

    const hairInk=new T.Color(0x282128),hairLight=new T.Color(0x554039);
    function hairSurface(a,v){
        const c=Math.cos(a),s=Math.sin(a),t=v*Math.PI*.5;
        const wave=Math.sin(13*a+6*v+1.9*Math.sin(3*a+3*v));
        const radius=Math.cos(t)**.66*(1+.022*wave);
        const line=.156+.072*c+.011*Math.sin(a*2+.5)-.015*Math.exp(-((a-.37)**2)/.045);
        const y=line+(.329-line)*Math.sin(t)+.0015*wave*radius;
        return [.121*s*radius+.007*v,y,.014-.128*c*radius+.028*v,
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
