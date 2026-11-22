import * as T from './vendor/three.module.min.js';

export function paintedMaterial(name,roughness,repeat=1){
    const map=new T.TextureLoader().load('./assets/'+name+'.webp');
    map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
    map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.setScalar(repeat);
    return new T.MeshStandardMaterial({map,roughness});
}
