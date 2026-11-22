import {courses,routePoint,cableHeight,openSpan,viewPoint} from './courses.js';
import {renderPixelRatio} from './viewport.js';
import {ease} from './motion.js';
import {caveFaces,tripStoneAt} from './cave.js';
// World units are metres. The camera looks along +z, with the runner at z = 8.
export function createScene(canvas, laneWidth) {
    const ctx = canvas.getContext('2d');
    const backdrop=new Image();backdrop.src='./assets/island-horizon.webp';
    const foliage=new Image();foliage.src='./assets/island-flora.webp';
    const wash=new Image();wash.src='./assets/trail-wash.webp';
    const trailColors=new Map();
    function trailPaint(land){
        if(!wash.naturalWidth)return null;
        if(!trailColors.has(land)){
            const tile=document.createElement('canvas');tile.width=256;tile.height=512;
            const brush=tile.getContext('2d');brush.drawImage(wash,0,0,256,512);
            brush.globalCompositeOperation='multiply';brush.fillStyle='#'+land.stone[1].toString(16);
            brush.fillRect(0,0,256,512);trailColors.set(land,tile);
        }
        return trailColors.get(land);
    }
    let w, h, horizon, center, focal;
    const tau = Math.PI * 2;
    let previousRatio=0;
    function resize(width,height,ratio) {
        w=width; h=height; previousRatio=ratio;
        canvas.width=Math.max(1,Math.floor(w*ratio));
        canvas.height=Math.max(1,Math.floor(h*ratio));
        ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);
    }
    function polygon(color, points) {
        ctx.beginPath();
        points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }
    function ellipse(color,x,y,rx,ry) {
        ctx.beginPath();
        ctx.ellipse(x,y,rx,ry,0,0,tau);
        ctx.fillStyle=color;
        ctx.fill();
    }
    function gradient(y1,y2,colors) {
        const g=ctx.createLinearGradient(0,y1,0,y2);
        colors.forEach(([n,c])=>g.addColorStop(n,c));
        return g;
    }
    let course, origin, cameraAt, runnerDepth;
    const sections=new Map();
    function project(x,y,z) {
        let row=sections.get(z);
        if(!row){
            const pt=routePoint(course,cameraAt+z-runnerDepth);
            const dx=pt.x-origin.x,dz=pt.z-origin.z;
            const cs=Math.cos(origin.heading),sn=Math.sin(origin.heading);
            const relative=pt.heading-origin.heading, sin=Math.sin(relative),cos=Math.cos(relative);
            row={x:cs*dx+sn*dz,depth:runnerDepth+sn*dx-cs*dz,
                right:cos+pt.shear*sin,slant:-sin+pt.shear*cos};
            sections.set(z,row);
        }
        const scale=focal/Math.max(.35,row.depth+x*row.slant);
        return [center+(row.x+x*row.right)*scale,horizon+(2.9-y)*scale];
    }
    function face(color,...points) { polygon(color,points.map(p=>project(...p))); }
    function island(x,y,size,colors) {
        const ridge=[[-1,0],[-.72,-.12],[-.46,-.42],[-.32,-.37],[-.14,-.72],[.01,-.7],[.19,-.45],[.31,-.4],[.51,-.19],[.78,-.12],[1,0]];
        ctx.beginPath();ctx.moveTo(x-size,y);
        for(let i=1;i<ridge.length-1;i++){
            const [a,b]=ridge[i],[c,d]=ridge[i+1];
            ctx.quadraticCurveTo(x+a*size,y+b*size,x+(a+c)*size/2,y+(b+d)*size/2);
        }
        ctx.lineTo(x+size,y);ctx.closePath();
        ctx.fillStyle=gradient(y-size*.75,y,[[0,colors[1]],[.6,colors[2]],[1,colors[0]]]);ctx.fill();
    }
    function palm(x,y,size,lean) {
        ctx.save();ctx.translate(x,y);ctx.scale(size*lean,size);
        ctx.fillStyle='#665340';ctx.beginPath();ctx.moveTo(-.06,0);
        ctx.quadraticCurveTo(.10,-.49,.16,-1.01);ctx.lineTo(.20,-1);
        ctx.quadraticCurveTo(.17,-.48,.04,0);ctx.fill();
        for(let k=0;k<8;k++){
            const a=k*tau/8+.19,dx=Math.cos(a)*.70,dy=Math.sin(a)*.31;
            ctx.strokeStyle=k%2?'#315c54':'#47755e';ctx.lineWidth=.012;
            ctx.beginPath();ctx.moveTo(.18,-1);
            ctx.quadraticCurveTo(.18+dx*.48,-1.28+dy*.25,.18+dx,-.88+dy);ctx.stroke();
            for(let j=1;j<10;j++){
                const t=j/11,cx=.18+t*dx,cy=-1-.48*t*(1-t)+dy*t+.12*t*t;
                const length=.16*Math.sin(Math.PI*t)+.03;
                ctx.fillStyle=k%2?'#376956':'#689065';ctx.beginPath();ctx.moveTo(cx,cy);
                ctx.quadraticCurveTo(cx+dx*.11,cy+.03,cx+dx*.15,cy+length);
                ctx.quadraticCurveTo(cx+dx*.04,cy+.04,cx,cy+.012);ctx.fill();
            }
        }
        ctx.restore();
    }

    function landscape(t) {
        const [lagoon,lava,fern,cliffs,plains,falls]=courses.map(c=>course===c);
        const sunX=center+w*.105,r=h*.095;
        if(backdrop.naturalWidth){
            const width=Math.max(w,1.8*focal),height=width*backdrop.naturalHeight/backdrop.naturalWidth;
            const shift=origin.heading/1.85*width;
            const offset=center-width*.5-shift;
            const first=Math.floor(-offset/width);
            for(let i=first;offset+i*width<w;i++){
                ctx.save();ctx.translate(offset+i*width+(i%2?width:0),horizon-height*.876);
                ctx.scale(i%2?-1:1,1);ctx.drawImage(backdrop,0,0,width,height);ctx.restore();
            }
        }else{
            ctx.fillStyle=gradient(0,horizon,[[0,'#436f86'],[.65,'#c0bbaf'],[1,'#ffcb9c']]);
            ctx.fillRect(0,0,w,horizon+1);ellipse('#ffe3a2',sunX,horizon-h*.16,r,r);
        }
        ctx.fillStyle=gradient(horizon,h,[[0,'#'+course.fog.toString(16)],[.3,'#'+course.water.toString(16)],[1,'#182e32']]);
        ctx.fillRect(0,horizon,w,h-horizon);
        for(let i=0;(lagoon || cliffs) && i<170;i++){
            const depth=((i*.61803+t*.019)%1)**2;
            const x=((i*.38291)%1)*w,y=horizon+depth*(h-horizon);
            ellipse(Math.abs(x-sunX)<r*(.4+depth)?'#f9d39699':'#c3e0c54d',x,y,w*(.002+depth*.019),.5+depth*h*.0017);
        }
        for(const [side,offset,depth] of [[-1,.56,.11],[1,.47,.075],[-1,.25,.028],[1,.28,.034]]){
            const x=center+side*w*offset,y=horizon+h*depth,s=h*(depth+.012);
            ellipse('#b5c4a2',x,y,s*2.1,s*.09);
            island(x,y,s*2,['#37585a','#406361','#547066']);
            if(lava){
                island(x,y,s*3.7,['#66525b','#503d47','#80594f']);
                polygon('#e38956',[[x-.08*s,y-.94*s],[x-.22*s,y-.58*s],[x-.06*s,y-.54*s],[x+.24*s,y-.12*s],[x-.14*s,y-.51*s],[x-.29*s,y-.55*s]]);
            }else if(cliffs){
                island(x,y,s*3,['#847c71','#968d79','#736d67']);
                for(let k=-2;k<=2;k++){
                    const surge=.9+.35*Math.sin(t*2+offset*25);
                    ellipse(k%2?'#e0eeea':'#a5d1d4',x+s*(.42+k*.09),y-s*surge*.43,s*.085,s*surge*(.59-.09*Math.abs(k)));
                }
            }else if(plains){
                island(x,y,s*3.4,['#7b8047','#939255','#a3995c']);
                for(let k=-3;k<4;k++){
                    const gx=x+k*s*.19;
                    polygon('#c1a45c',[[gx,y],[gx-s*.09,y-s*.29],[gx+s*.02,y-s*.14],[gx+s*.08,y-s*.34],[gx+s*.05,y]]);
                }
            }else if(falls){
                island(x,y,s*4,['#35584f','#466a5c','#537760']);
                polygon('#a7d5d0',[[x-s*.50,y-s*1.65],[x-s*.27,y-s*1.64],[x-s*.28,y],[x-s*.60,y]]);
                ellipse('#dfebe0',x-s*.45,y,s*.31,s*.06);
            }else if(fern){
                for(let k=-3;k<=3;k++){
                    const fx=x+k*s*.26, fy=y-s*.14, crown=fy-s*(.55+.14*Math.cos(k));
                    polygon('#514738',[[fx-s*.037,fy],[fx+s*.043,fy],[fx+s*.032,crown],[fx-s*.025,crown]]);
                    for(const side of [-1,1])for(let j=0;j<3;j++){
                        const reach=(.27+j*.10)*s*side;
                        polygon(j%2?'#476f58':'#345f52',[[fx,crown],[fx+reach*.6,crown-s*(.23-j*.06)],
                            [fx+reach,crown+s*(j*.11-.09)],[fx+reach*.5,crown-s*.03]]);
                    }
                }
            }else{
                palm(x+s*.26,y-s*.37,s*1.5,side);
                palm(x-s*.42,y-s*.24,s*1.04,-side);
            }
        }
    }
    function box(x,y,z,rx,height,rz,colors) {
        const l=x-rx,r=x+rx,n=z-rz,f=z+rz,top=y+height;
        face(colors[0],[l,top,n],[r,top,n],[r,y,n],[l,y,n]);
        const edge=x>0?l:r;
        face(colors[1],[edge,top,f],[edge,top,n],[edge,y,n],[edge,y,f]);
        face(colors[2],[l,top,f],[r,top,f],[r,top,n],[l,top,n]);
    }
    function torch(x,z,t) {
        box(x,-.15,z,.12,1.84,.12,['#574337','#392f32','#97784e']);
        for(const y of [.15,1.27,1.5]) box(x,y,z,.15,.09,.15,['#c59b63','#89714d','#dbc194']);
        const [px,py]=project(x,1.68,z),s=focal/z;
        const glow=ctx.createRadialGradient(px,py,0,px,py,s*.7);
        glow.addColorStop(0,'#ffb84777');glow.addColorStop(1,'#ffc16400');
        ellipse(glow,px,py,s*.7,s*.7);
        polygon('#ff8c39',[[px-s*.13,py],[px+s*.04,py-s*(.64+.08*Math.sin(t*9+z))],[px+s*.15,py],[px,py+s*.12]]);
        polygon('#ffe79b',[[px-s*.07,py],[px,py-s*.3],[px+s*.07,py]]);
    }
    function road() {
        const next=courses[(courses.indexOf(course)+1)%courses.length];
        const palettes=[course,next].map(c=>c.stone.map(color=>'#'+color.toString(16)));
        const edge=2.45;
        const eyeX=origin.x-runnerDepth*Math.sin(origin.heading);
        const eyeZ=origin.z+runnerDepth*Math.cos(origin.heading);

        for(let at=Math.floor(cameraAt)+142;at>=Math.floor(cameraAt-runnerDepth);at--){
            const z=runnerDepth+at-cameraAt,n=Math.max(.8,z-.5),f=z+.49;
            const beyond=at>=course.length, localAt=beyond?at-course.length:at;
            const land=beyond?next:course;
            if(f<=n || openSpan(land,localAt))continue;
            const centerline=routePoint(course,at);
            const eyeLane=(eyeX-centerline.x)*Math.cos(centerline.heading)+(eyeZ-centerline.z)*Math.sin(centerline.heading);
            const stone=palettes[Number(beyond)];
            const row=(at%12+12)%12;
            const pts=[project(-edge,0,n),project(edge,0,n),project(edge,0,f),project(-edge,0,f)];
            polygon(stone[1],pts);
            const tile=trailPaint(land);
            if(tile && Math.abs(pts[0][1]-pts[3][1])+Math.abs(pts[0][0]-pts[3][0])>2){
                const [a,b,c,d]=pts;
                const nearX=b[0]-a[0],nearY=b[1]-a[1];
                const alongX=(c[0]+d[0]-a[0]-b[0])/2,alongY=(c[1]+d[1]-a[1]-b[1])/2;
                ctx.save();ctx.clip();
                ctx.transform(nearX/256,nearY/256,alongX/64,alongY/64,a[0],a[1]);
                ctx.drawImage(tile,0,((at%8+8)%8)*64,256,64,-6,-1,268,66);
                ctx.restore();
            }
            if(openSpan(land,localAt+1))face('#e3ba79',[-edge,.02,f],[edge,.02,f],[edge,.02,f-.16],[-edge,.02,f-.16]);
            if(openSpan(land,localAt-1))face('#665448',[-edge,0,n],[edge,0,n],[edge,-.55,n],[-edge,-.55,n]);
            for(const side of [-1,1]){
                const x=edge*side, outer=x+side*.24;
                if(side*(eyeLane-outer)>0)face('#584a44',[outer,0,f],[outer,0,n],[outer,-.5,n],[outer,-.5,f]);
                face(row%2?'#92846c':'#9c8f73',[x,.035,f],[outer,.035,f],[outer,.035,n],[x,.035,n]);
            }
        }
    }
    function gem(e,z,t) {
        const x=e.x, y=e.height+.08*Math.sin(t*3+e.at), ring=[];
        for(let i=0;i<6;i++){const a=i*tau/6+t*2;ring.push([x+Math.cos(a)*.28,y,z+Math.sin(a)*.28]);}
        const facets=ring.map((p,i)=>[p,ring[(i+1)%6],i]).sort((a,b)=>b[0][2]+b[1][2]-a[0][2]-a[1][2]);
        for(const [a,b,i] of facets){
            face(['#fff2aa','#ffd36a','#f5af41'][i%3],a,b,[x,y+.42,z]);
            face(['#e99932','#c47728','#edac44'][i%3],a,b,[x,y-.38,z]);
        }
    }
    function timber(x,y,z,half,radius,bindings){
        const l=x-half,r=x+half;
        const wood=['#5b4037','#85553e','#a17750','#c79b69','#d0a97d'];
        for(let i=0;i<5;i++){
            const a=-Math.PI*.5+i*Math.PI/5,b=a+Math.PI/5;
            const ya=y+radius*Math.sin(a),yb=y+radius*Math.sin(b);
            const za=z-radius*Math.cos(a),zb=z-radius*Math.cos(b);
            face(wood[i],[l,ya,za],[r,ya,za],[r,yb,zb],[l,yb,zb]);
            if(bindings)for(const side of [-1,1]){
                const x0=x+side*half*.74;
                face(i<2?'#ad8559':'#e1c292',[x0-.035,ya,za],[x0+.035,ya,za],[x0+.035,yb,zb],[x0-.035,yb,zb]);
            }
        }
        const end=x>0?l:r,ring=[];
        for(let i=0;i<14;i++)ring.push(project(end,y+radius*Math.sin(i*tau/14),z+radius*Math.cos(i*tau/14)));
        polygon('#ae8055',ring);
    }
    function obstacle(e,z,t) {
        if(e.kind==='hurdle'){
            timber(0,.30,z,2.5,.30,false);return;
        }
        const gate=e.kind==='gate',fall=e.struckAt===undefined?0:ease((t-e.struckAt)/.3);
        if(gate)for(const offset of [-.71,.71])box(e.x+offset,0,z,.08,1.85,.12,['#83593c','#614536','#b28b5c']);
        const y=gate?1.46:.33;
        for(const dy of [-.15,.13])timber(e.x,gate?y+dy:(y+dy)*(1-fall)+.16*fall,z+dy*fall,.79,.18,true);
    }
    const athlete=new Image();
    athlete.src='assets/runner-poses.webp';
    const actions=new Image();
    actions.src='assets/runner-actions.webp';
    const rider=new Image();
    rider.src='assets/runner-zip.webp';
    const ridgeback=new Image();
    ridgeback.src='assets/ridgeback-poses.webp';
    const capture=new Image();
    capture.src='assets/ridgeback-grab.webp';
    function grab(x,z,hold){
        const frame=Math.min(15,Math.round(hold/1.65*15));
        const [px,py]=project(x,0,z),scale=focal/z;
        ellipse('#3e40474d',px,py,scale*.78,scale*.20);
        ctx.drawImage(capture,frame%8*384,Math.floor(frame/8)*256,384,256,
            px-2.1*scale,py-2.1*scale,4.2*scale,2.8*scale);
    }
    function caveWall(face,origin){
        // Clip a facet when the camera crosses it at the cave entrance.
        const points=face.vertices.map(([x,y,d])=>[x,y,origin+d]);
        const clipped=[];
        for(let i=0;i<3;i++){
            const a=points[i], b=points[(i+1)%3];
            if(a[2]>=.8)clipped.push(a);
            if((a[2]>=.8)!==(b[2]>=.8)){
                const u=(.8-a[2])/(b[2]-a[2]);
                clipped.push([a[0]+u*(b[0]-a[0]),a[1]+u*(b[1]-a[1]),.8]);
            }
        }
        if(clipped.length>=3)polygon('#'+face.color.toString(16),clipped.map(p=>project(...p)));
    }
    function beast(x,z,distance,awake=1){
        if(!ridgeback.naturalWidth)return;
        const [px,py]=project(x,0,z),scale=focal/z;
        const phase=Math.floor(distance*2.28/(Math.PI*2)*8)%8;
        ellipse('#3e40474d',px,py,scale*.52,scale*.18);
        const height=scale*(.54+.46*awake);
        ctx.drawImage(ridgeback,phase*240,0,240,224,px-scale*1.34,py-height*1.70,
            scale*2.68,height*2.50);
    }
    function runner(player,distance,active,stumble,z,hasGround) {
        const scale=focal/z, x=center+player.x*scale,ground=horizon+2.9*scale;
        if(hasGround)ellipse('#3e40474d',x,ground,scale*.37,scale*.10);
        const grip=rider.naturalWidth?(player.grip||0):0;
        if(grip>.001){
            ctx.save();ctx.globalAlpha=grip;
            ctx.drawImage(rider,x-.8*scale,ground-(player.y+2.13)*scale,1.6*scale,2.24*scale);
            ctx.restore();
            if(grip>.999)return;
        }
        if(!athlete.naturalWidth)return;
        const phase=Math.floor(distance/4.25*8)%8;
        let frame=phase,row=0;
        if(!active){row=2;frame=7;}
        else if(player.kneeling>.05){row=1;frame=Math.round(player.kneeling*7);}
        else if(player.fallen>.05){row=0;frame=2;}
        else if(player.crouch>.08){row=1;frame=Math.round(player.crouch*7);}
        else if(player.y>.08){row=2;frame=Math.min(6,phase);}
        let actionRow=0,u=0,weight=0,mirror=1;
        if(actions.naturalWidth){
            if(player.drop){
                actionRow=player.drop.kind==='corner'?5:player.drop.kind==='zipline'?4:3;
                u=player.drop.phase;weight=ease(u/.12);mirror=player.drop.direction;
            }else if(player.impact){
                actionRow=player.impact.kind==='gate'?2:1;
                u=player.impact.phase;weight=ease(u/.1)*(1-ease((u-.84)/.16));
            }else if(player.pivot){
                u=player.pivot.phase;weight=ease(u/.16)*(1-ease((u-.80)/.20));mirror=player.pivot.direction;
            }
        }
        ctx.save();
        ctx.translate(x,ground-(player.y+.26*player.fallen)*scale);
        ctx.rotate((player.laneVelocity||0)*.012+stumble*.61+player.fallen*1.48+player.kneeling*.14);
        if(weight<1){
            ctx.globalAlpha=(1-weight)*(1-grip);
            ctx.drawImage(athlete,frame*160,row*224,160,224,-.75*scale,-1.92*scale,1.5*scale,2.1*scale);
        }
        if(weight>0){
            ctx.scale(mirror,1);
            ctx.globalAlpha=weight*(1-grip);
            ctx.drawImage(actions,Math.round(u*19)*176,actionRow*154,176,154,
                -1.36*scale,-2.08*scale,2.72*scale,2.38*scale);
        }
        ctx.restore();
    }
    return function draw(state, distance, player, entities, time, menuBlend, chase,selectedCourse) {
        const width=canvas.clientWidth, height=canvas.clientHeight;
        if(!width || !height)return;
        const ratio=renderPixelRatio(width,height);
        if(width!==w || height!==h || ratio!==previousRatio)resize(width,height,ratio);
        const portrait=w<h*.84;
        center=w*(.5+menuBlend*(portrait?.12:.19));
        horizon=h*((portrait?.45:.43)-menuBlend*(portrait?.22:0));
        if(player.drop)horizon-=h*.15*ease(player.drop.phase)*(1-menuBlend);
        focal=Math.min(h*(portrait?.98:1.18),w*1.65);
        const strideDistance=state==='intro' ? chase.runIn : chase.completedDistance+distance+(chase.runIn || 0);
        const opening=state==='intro';
        const focus=opening ? Math.min(1,Math.max(0,(chase.intro-3.30)/.63),Math.max(0,(7.45-chase.intro)/1.8)) : 0;
        const pullback=focus*1.8;
        const roadDistance=32+strideDistance-pullback;
        course=selectedCourse;origin=viewPoint(course,distance,chase,player);cameraAt=distance;runnerDepth=8+pullback;
        sections.clear();landscape(time);road();
        const items=[];
        if(foliage.naturalWidth){
            const index=courses.indexOf(course);
            for(let at=Math.max(0,Math.ceil((distance-3)/8)*8);at<Math.min(course.length,distance+64);at+=8){
                if(openSpan(course,at) || course.turns.some(([bend])=>Math.abs(at-bend)<8))continue;
                const z=runnerDepth+at-distance;
                for(const side of [-1,1]){
                    const tree=at%16===(side<0?0:8),lush=index===0 || index===2 || index===5;
                    const type=tree && lush?(index===0?0:1):lush?2:3;
                    const x=side*(tree && lush?7.4:4.1);
                    const worldH=[5.8,5.4,1.24,1.05][type]*(1+.11*Math.sin(at+side));
                    const aspect=[.77,1.23,1.93,2.32][type];
                    items.push({z,draw:()=>{
                        const [cx,base]=project(x,-.38,z),[,top]=project(x,worldH-.38,z),height=base-top;
                        if(height<=0 || height>3*h)return;
                        ctx.drawImage(foliage,type%2*512+3,Math.floor(type/2)*512+3,506,506,
                            cx-height*aspect/2,top,height*aspect,height);
                    }});
                }
            }
        }
        if(course===courses[0] && !chase.completedDistance && (opening || (state==='playing' && distance<20))){
            const origin=8+pullback-strideDistance;
            for(const face of caveFaces){
                const z=origin+face.vertices.reduce((sum,v)=>sum+v[2],0)/3;
                items.push({z,draw:()=>caveWall(face,origin)});
            }
            const roll=opening?chase.stone:1, z=origin+tripStoneAt-.49*roll;
            if(z>1)items.push({z,draw:()=>{
                const [x,y]=project(.09+1.02*roll,.13+.18*Math.sin(Math.PI*roll),z),r=focal*.32/z;
                polygon('#b28c69',[[x-r,y],[x-r*.4,y-r*.68],[x+r*.62,y-r*.45],[x+r,y+r*.4],[x-r*.6,y+r*.42]]);
            }});
        }
        for(let i=0;i<13;i++){
            const z=4+i*11-roadDistance%11;
            const at=distance+z-runnerDepth;
            if(z>2 && at<course.length && !openSpan(course,at))items.push({z,draw:()=>{torch(-2.69,z,time);torch(2.69,z,time);}});
        }
        const cable=course.cable, cx=cable.lane*laneWidth;
        const trackZ=d=>runnerDepth+d-distance;
        for(const [at,dir] of course.turns){
            const z=trackZ(at-3),x=-dir*2.85;
            if(z<1.5)continue;
            items.push({z,draw:()=>{
                box(x,0,z,.08,1.6,.08,['#795537','#60432e','#aa8754']);
                box(x,1.26,z,.66,.72,.08,['#283c32','#24332c','#556657']);
                for(const offset of [-.24,.16]){
                    const a=x+offset, front=z-.10;
                    face('#ffd174',[a-dir*.14,1.88,front],[a+dir*.18,1.62,front],[a-dir*.14,1.36,front],
                        [a-dir*.24,1.42,front],[a+dir*.01,1.62,front],[a-dir*.24,1.82,front]);
                }
            }});
        }
        for(let d=cable.at;d<cable.end;d++){
            const z=trackZ(d), y=cableHeight(cable,d)+.4, nextY=cableHeight(cable,d+1)+.4;
            if(z>1.5)items.push({z,draw:()=>face('#5f4636',[cx-.06,y,z],[cx+.06,y,z],[cx+.06,nextY,z+1],[cx-.06,nextY,z+1])});
        }
        for(const d of [cable.at,cable.end]){
            const z=trackZ(d), post=cx<0?-2.66:2.66,y=cableHeight(cable,d)+.4;
            if(z>1.5)items.push({z,draw:()=>{
                const wood=['#805335','#68432d','#b28b58'];
                box(post,0,z,.14,y,.14,wood);box((cx+post)/2,y,z,Math.abs(cx-post)/2+.08,.18,.12,wood);
            }});
        }
        const gripAt=player.riding?distance:cable.at, gripZ=trackZ(gripAt);
        if(player.riding || distance<cable.at+1)items.push({z:gripZ-.01,draw:()=>{
            const y=cableHeight(cable,gripAt), gold=['#dba852','#a07739','#ffe1a1'];
            box(cx,y,gripZ,.35,.09,.07,gold);box(cx,y,gripZ,.035,.4,.04,gold);
        }});
        for(const gateAt of (chase.completedDistance && distance<10?[0,course.length]:[course.length])){
            const finishZ=trackZ(gateAt);
            if(finishZ>1.5)items.push({z:finishZ,draw:()=>{
                const trim=['#dfa651','#ac7d44','#ffe2a3'];
                for(const x of [-2.75,2.75])box(x,0,finishZ,.12,3.55,.12,trim);
                box(0,3.4,finishZ,2.85,.30,.12,trim);
            }});
        }
        for(const e of entities){
            const z=e.at-distance+8+pullback;
            if(z>1.5&&z<155)items.push({z,draw:()=>e.kind==='gem'?gem(e,z,time):obstacle(e,z,time)});
        }
        const gripped=(state==='catching'||state==='over') && chase.hold>0 && capture.naturalWidth>0;
        if(gripped){
            items.push({z:7,draw:()=>grab(player.x,7,chase.hold)});
        }else{
            const z=8+pullback-chase.stumble*.48;
            items.push({z,draw:()=>runner(player,strideDistance,state!=='start',chase.stumble,z,!openSpan(course,distance) && !chase.failure)});
        }
        if(state!=='start' && !gripped){
            const z=8+pullback-(.8+chase.lead+chase.stumble*.48);
            if(z>1.5 && !chase.failure && !openSpan(course,distance+z-runnerDepth))items.push({z,draw:()=>beast(chase.x,z,chase.stride,opening?chase.wake:1)});
        }
        items.sort((a,b)=>b.z-a.z).forEach(item=>item.draw());
        const shade=ctx.createLinearGradient(0,0,portrait?0:w,portrait?h:0);
        shade.addColorStop(0,`rgba(14,33,45,${.12+.74*menuBlend})`);
        shade.addColorStop(.52,`rgba(14,33,45,${.02+.25*menuBlend})`);shade.addColorStop(1,'transparent');
        ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
        ctx.fillStyle=gradient(0,h,[[0,'#14233377'],[.18,'transparent'],[.8,'transparent'],[1,'#172b38a8']]);
        ctx.fillRect(0,0,w,h);
    };
}
