import {swells} from './water.js';
import * as T from './vendor/three.module.min.js';

// A single curved leaf carries a painted silhouette, including the spaces
// between leaflets. Every palm shares this texture and geometry.
export function palmFrond(){
    const canvas=document.createElement('canvas');canvas.width=192;canvas.height=384;
    const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    const rib=y=>w*(.5+.035*Math.sin(y/h*Math.PI));
    for(let i=0;i<25;i++)for(const side of [-1,1]){
        const f=(i+.4)/26, y=(.04+.86*f)*h, x=rib(y);
        const span=w*(.14+.33*Math.sin(Math.PI*(f+.04))**.8)*(1-.47*f);
        const tip=x+side*span, end=y+(.07+.13*f)*h;
        g.fillStyle=['#86b29a','#afd1aa','#d0dcac','#a8c58e'][(i+(side+1))%4];
        g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+side*span*.68,y+.012*h,tip,end);
        g.quadraticCurveTo(x+side*span*.47,y+.076*h,x,y+.026*h);g.fill();
    }
    g.strokeStyle='#cec590';g.lineWidth=3;g.beginPath();g.moveTo(rib(0),0);
    g.quadraticCurveTo(w*.57,h*.5,w*.50,h);g.stroke();
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.flipY=false;
    const positions=[],uv=[],indices=[];
    for(let row=0;row<=7;row++){
        const t=row/7;
        for(let col=0;col<3;col++){
            const side=col-1;
            positions.push(side*.5,.24*Math.sin(t*Math.PI)-.21*t*t-.065*Math.abs(side),t);
            uv.push(col/2,t);
            if(row && col){const a=row*3+col;indices.push(a-4,a-1,a,a-4,a,a-3);}
        }
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
    return {geo,mat:new T.MeshStandardMaterial({map:texture,side:T.DoubleSide,alphaTest:.35,roughness:.83})};
}

export function coastalStone(){
    const g=new T.IcosahedronGeometry(.5,1),pos=g.attributes.position;
    const pigment=[];
    for(let i=0;i<pos.count;i++){
        const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
        const k=1+.10*Math.sin(7*x+3*z)*Math.cos(6*y-z)+.07*Math.sin(8*z-3*y);
        pos.setXYZ(i,x*k+.05*y, y*k, z*k);
        const sunward=T.MathUtils.smoothstep(y+.15*x,-.32,.42);
        const vein=.04*Math.sin(11*z+5*x-8*y);
        pigment.push(.71+.29*sunward+vein,.78+.22*sunward+vein,.86+.08*sunward+vein);
    }
    g.setAttribute('color',new T.Float32BufferAttribute(pigment,3));
    return g;
}

export function trailMaterial(loader){
    const map=loader.load('./assets/trail-wash.webp');map.colorSpace=T.SRGBColorSpace;
    map.wrapT=T.RepeatWrapping;map.anisotropy=4;
    const mat=new T.MeshStandardMaterial({map,roughness:1});
    mat.onBeforeCompile=shader=>{
        // Each metre of the instanced trail samples a different strip of paint.
        shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',
            '#include <uv_vertex>\n vMapUv.y=(vMapUv.y+dot(instanceMatrix[3].xz,vec2(1.0,-1.0)))*0.125;');
    };
    return mat;
}

export function waterMaterial(time){
    const mat=new T.MeshStandardMaterial({color:0x43a8aa,roughness:.34,metalness:.09});
    const origin={value:new T.Vector2()}, heading={value:new T.Vector2(1,0)};
    // xy is the impact in island coordinates, z its age, and w its strength.
    const impact={value:new T.Vector4(0,0,-1,0)};
    const waveTerms=swells.map(({kx,kz,omega,amplitude,phase})=>
        `addSwell(surface, p, vec2(${kx},${kz}), ${omega}, ${amplitude}, ${phase.toFixed(2)});`).join('\n');
    mat.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,{waterTime:time,waterOrigin:origin,waterHeading:heading,waterImpact:impact});
        shader.vertexShader=`
            varying vec2 waterPoint;
            varying float waveHeight;
            uniform float waterTime;
            uniform vec2 waterOrigin,waterHeading;
            uniform vec4 waterImpact;
            void addSwell(inout vec3 surface,vec2 p,vec2 k,float rate,float amplitude,float offset){
                float phase=dot(p,k)-waterTime*rate+offset;
                surface+=amplitude*vec3(sin(phase),k*cos(phase));
            }
        `+shader.vertexShader.replace('#include <beginnormal_vertex>',`
            #include <beginnormal_vertex>
            vec2 local=(modelMatrix*vec4(position,1.)).xz;
            vec2 p=waterOrigin+vec2(dot(local,vec2(waterHeading.x,-waterHeading.y)),dot(local,waterHeading.yx));
            waterPoint=p;
            vec3 surface=vec3(0.);
            ${waveTerms}
            vec2 delta=p-waterImpact.xy;
            float radius=length(delta), age=waterImpact.z;
            float front=radius-2.8*age;
            float envelope=waterImpact.w*exp(-front*front*2.4-1.3*max(age,0.));
            surface.x+=.14*envelope*cos(6.*front);
            surface.yz+=.14*envelope*(-4.8*front*cos(6.*front)-6.*sin(6.*front))*delta/max(radius,.001);
            vec2 slope=vec2(dot(surface.yz,waterHeading),dot(surface.yz,vec2(-waterHeading.y,waterHeading.x)));
            objectNormal=normalize(vec3(-slope.x,1.,-slope.y));
            waveHeight=surface.x;
        `).replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.y+=waveHeight;');
        shader.fragmentShader='varying vec2 waterPoint; varying float waveHeight; uniform float waterTime; uniform vec4 waterImpact;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
            #include <color_fragment>
            float chop=sin(dot(waterPoint,vec2(1.4,3.1))-3.9*waterTime+.65*sin(waterPoint.x+waterTime));
            float glint=smoothstep(.66,.96,chop)*(1.-smoothstep(.15,1.,fwidth(chop)));
            float crest=smoothstep(.015,.20,waveHeight);
            float front=length(waterPoint-waterImpact.xy)-2.8*waterImpact.z;
            float foam=waterImpact.w*exp(-5.*front*front-1.6*max(0.,waterImpact.z));
            diffuseColor.rgb*=.80+.30*crest;
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.73,.91,.84),clamp(.32*crest*glint+foam,0.,.87));`);
    };
    return {mat,origin,heading,impact};
}

// Painted cutouts turn about their roots, so the same silhouette holds up
// from either leg of a corner without duplicating foliage overdraw.
export function paintedFlora(loader){
    const texture=loader.load('./assets/island-flora.webp');texture.colorSpace=T.SRGBColorSpace;texture.flipY=false;
    const mat=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,alphaTest:.32});
    mat.onBeforeCompile=shader=>{
        shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
            vec4 base=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
            vec3 up=normalize(mat3(viewMatrix)*vec3(0.,1.,0.));
            vec3 right=normalize(cross(vec3(0.,0.,-1.),up));
            vec4 mvPosition=base+vec4(right*position.x*length(instanceMatrix[0].xyz)+up*position.y*length(instanceMatrix[1].xyz),0.);
            gl_Position=projectionMatrix*mvPosition;`);
    };
    const shapes=Array.from({length:4},(_,i)=>{
        const geo=new T.PlaneGeometry(1,1);geo.translate(0,.5,0);
        const uv=geo.attributes.uv;
        for(let j=0;j<uv.count;j++)uv.setXY(j,(i%2+.002+uv.getX(j)*.996)/2,
            (Math.floor(i/2)+.002+(1-uv.getY(j))*.996)/2);
        return geo;
    });
    return {shapes,mat};
}
