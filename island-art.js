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
    const mat=new T.MeshStandardMaterial({color:0x43a8aa,roughness:.62,metalness:.07});
    const origin={value:new T.Vector2()}, heading={value:new T.Vector2(1,0)};
    mat.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,{waterTime:time,waterOrigin:origin,waterHeading:heading});
        shader.vertexShader='varying vec2 waterPoint; uniform vec2 waterOrigin,waterHeading;\n'+shader.vertexShader.replace('#include <project_vertex>',
            '#include <project_vertex>\n vec2 p=(modelMatrix*vec4(transformed,1.)).xz;waterPoint=waterOrigin+vec2(dot(p,vec2(waterHeading.x,-waterHeading.y)),dot(p,waterHeading.yx));');
        shader.fragmentShader='varying vec2 waterPoint; uniform float waterTime;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
            #include <color_fragment>
            vec2 p=waterPoint;float t=waterTime*.42;
            float swell=sin(p.y*1.7+.47*sin(p.x*.61+t)+.28*sin(p.x*1.4-t)-t);
            float broken=smoothstep(.12,.83,sin(p.x*.92+p.y*.24+t)+.4*sin(p.x*2.03-t));
            float glint=smoothstep(.91,.99,swell)*broken*(1.-smoothstep(.22,.80,fwidth(swell)));
            diffuseColor.rgb*=.96+.075*sin(p.x*.48+p.y*.35+t);
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.70,.85,.71),.25*glint); `);
    };
    return {mat,origin,heading};
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
