import {
  Scene, Color, Vector2, Vector3, Box3, Raycaster, OrthographicCamera, WebGLRenderer,
  HemisphereLight, DirectionalLight, OrbitControls, GLTFLoader, ACESFilmicToneMapping
} from './vendor/inspection-three.mjs';
import {parts} from './parts.mjs?v=family-glossary';

const layouts = {
  assembled: ['Assembled', 'The outside of the lock, with its parts in place.'],
  cutaway: ['Cutaway', 'The near side is open. The parts are still in their working positions.'],
  exploded: ['Exploded', 'The housing is open and the parts are spaced apart. Rotate the model to look between them.']
};

export function mount(host, family) {
  const {items, look} = parts[family];
  // In an article the wheel scrolls the page; Ctrl/Cmd-scroll and trackpad pinch (ctrlKey) still zoom.
  const embedded = window !== window.parent;
  host.innerHTML = `<div class="parts-layout">
    <div class="plate">
      <div class="viewbar" role="group" aria-label="Model view">${Object.entries(layouts).map(([key,[label]])=>`<button data-layout="${key}" aria-pressed="${key==='cutaway'}">${label}</button>`).join('')}</div>
      <div class="model-stage"><span class="model-label" hidden></span><p class="model-status" role="status">Loading the model…</p></div>
      <div class="model-tools"><span>Drag to rotate · Shift-drag to pan · ${embedded?'Ctrl/⌘-scroll':'Scroll'} or pinch to zoom</span>
        <div><button data-action="minus" aria-label="Zoom out">−</button><button data-action="plus" aria-label="Zoom in">+</button><button data-action="reset">Reset view</button></div>
      </div>
    </div>
    <aside class="part-details"><h2>Inside the lock</h2><p>${look}</p>
      <label for="part-choice">Inspect a part</label>
      <select id="part-choice"><option value="">All parts</option>${Object.entries(items).map(([key,[label]])=>`<option value="${key}">${label}</option>`).join('')}</select>
      <div aria-live="polite"><p class="part-description">This model stays still while you explore. Select a part to see what it does.</p></div>
      <button data-action="isolate" aria-pressed="false" aria-describedby="isolate-hint" title="Select a part first" disabled>Show this part alone</button>
      <p class="isolate-hint" id="isolate-hint">Select a part to show it on its own.</p>
      <p class="layout-description" aria-live="polite"></p>
    </aside></div>`;
  const find = s => host.querySelector(s);
  const stage = find('.model-stage');
  const status = find('.model-status');
  const choice = find('#part-choice');
  const isolateButton = find('[data-action=isolate]');
  let renderer;
  function failure(message) {
    status.hidden=false;
    status.textContent=message;
    for(const el of host.querySelectorAll('button, select')) el.disabled=true;
  }
  try {renderer = new WebGLRenderer({antialias:true, alpha:false});}
  catch {failure('3D graphics are unavailable in this browser. Open the lesson drawing to see inside the lock.');return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
  renderer.toneMapping=ACESFilmicToneMapping;
  const canvas=renderer.domElement;
  canvas.tabIndex=0;
  canvas.setAttribute('aria-label','Interactive lock model. Drag or use the arrow keys to rotate. Use plus and minus to zoom.');
  stage.prepend(canvas);
  if(embedded)stage.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)e.stopPropagation();},{capture:true});
  const scene=new Scene();
  scene.background=new Color('#243e3e');
  scene.add(new HemisphereLight(0xfff7e7,0x869da5,1.65));
  for(const [position,power] of [[[1,4,3],2.65],[[-4,2,-1],2],[[2,-1,2],.8]]) {
    const light=new DirectionalLight(0xfff6e6,power);
    light.position.set(...position);
    scene.add(light);
  }

  const camera=new OrthographicCamera(-4,4,3,-3,.02,120);
  const orbit=new OrbitControls(camera,canvas);
  orbit.minZoom=.32;orbit.maxZoom=8;
  orbit.addEventListener('change',paint);
  const raycaster=new Raycaster();
  let gone=false, model=null, layout='cutaway', selected='', alone=false, extent=3;
  const nodes=[], surfaces=[], materials=new Set(), geometries=new Set();
  function paint(){if(!gone)renderer.render(scene,camera);}
  function resize(){
    const {width,height}=stage.getBoundingClientRect();
    if(!width||!height)return;
    const aspect=width/height;
    // Fit a sphere on portrait screens and reserve space for orbiting on wider screens.
    const halfHeight=extent/Math.min(1,aspect);
    camera.top=halfHeight;camera.bottom=-halfHeight;
    camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);paint();
  }
  const observer=new ResizeObserver(resize);observer.observe(stage);
  function frame(reset=false) {
    const bounds=new Box3();
    for(const {node} of nodes)if(node.visible)bounds.expandByObject(node,true);
    if(bounds.isEmpty())return;
    const target=bounds.getCenter(new Vector3());
    const direction=reset?new Vector3(...(parts[family].camera||[-.68,.42,1])):camera.position.clone().sub(orbit.target);
    orbit.target.copy(target);
    camera.position.copy(target).addScaledVector(direction.normalize(),15);
    camera.lookAt(target);camera.updateMatrixWorld();
    const aspect=stage.clientWidth/stage.clientHeight;
    let halfHeight=0;
    // Frame the visible geometry in the current camera plane, including the corners of covers.
    for(const {mesh,owner} of surfaces){
      if(!owner.visible)continue;
      if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
      const {min,max}=mesh.geometry.boundingBox;
      for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z]){
        const pt=new Vector3(x,y,z).applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
        halfHeight=Math.max(halfHeight,Math.abs(pt.y),Math.abs(pt.x)/aspect);
      }
    }
    extent=Math.max(.42,halfHeight*1.13)*Math.min(1,aspect);
    camera.zoom=1;orbit.update();resize();
  }
  let movement;
  function apply(refit=false,reset=false,animate=false) {
    cancelAnimationFrame(movement);
    const travel=[];
    for(const {node,key,base,offset,cover} of nodes) {
      const start=node.position.clone();
      node.position.copy(base);
      if(layout==='exploded'&&!alone)node.position.add(offset);
      if(animate&&!start.equals(node.position))travel.push({node,start,end:node.position.clone()});
      node.visible=alone?key===selected:layout==='assembled'||!cover;
    }
    for(const surface of surfaces) {
      const {key,material}=surface;
      material.emissive.setHex(selected&&key===selected?0xffb451:0);
      material.emissiveIntensity=.34;
      material.color.copy(surface.color);
      if(selected&&key!==selected)material.color.multiplyScalar(.46);
    }
    model?.updateMatrixWorld(true);
    const label=find('.model-label');
    label.hidden=!selected;
    label.textContent=selected?items[selected][0]:'';
    choice.value=selected;
    isolateButton.disabled=!selected;
    isolateButton.title=selected?'':'Select a part first';
    find('.isolate-hint').hidden=Boolean(selected);
    isolateButton.textContent=alone?'Show all parts':'Show this part alone';
    isolateButton.setAttribute('aria-pressed',String(alone));
    find('.part-description').textContent=selected?items[selected][1]:'This model stays still while you explore. Select a part to see what it does.';
    find('.layout-description').textContent=alone?'Showing this part on its own.':layouts[layout][1];
    for(const b of host.querySelectorAll('[data-layout]'))b.setAttribute('aria-pressed',String(!alone&&b.dataset.layout===layout));
    if(refit)frame(reset);
    if(travel.length&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      const startTime=performance.now();
      const move=now=>{
        const t=Math.min(1,(now-startTime)/380);
        for(const {node,start,end} of travel)node.position.lerpVectors(start,end,t*t*(3-2*t));
        paint();
        if(t<1)movement=requestAnimationFrame(move);
      };
      move(startTime);
    }else paint();
  }
  function select(key,fromList) {
    const refit=alone||(fromList&&key&&layout==='assembled');
    selected=key;
    if(!selected)alone=false;
    if(fromList&&selected&&layout==='assembled'&&!alone)layout='cutaway';
    apply(refit);
  }
  function zoom(scale){
    camera.zoom=Math.min(orbit.maxZoom,Math.max(orbit.minZoom,camera.zoom*scale));
    camera.updateProjectionMatrix();paint();
  }
  function control(e){
    const b=e.target.closest('button');if(!b||!model)return;
    if(b.dataset.layout){layout=b.dataset.layout;alone=false;apply(true,false,true);return;}
    switch(b.dataset.action){
      case 'isolate':alone=!alone;apply(true);break;
      case 'minus':zoom(1/1.25);break;
      case 'plus':zoom(1.25);break;
      case 'reset':frame(true);break;
    }
  }
  choice.addEventListener('change',()=>select(choice.value,true));
  host.addEventListener('click',control);
  canvas.addEventListener('keydown',e=>{
    const key=e.key;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(key))return;
    e.preventDefault();
    if(key==='Home'){frame(true);return;}
    if(['+','=','-'].includes(key)){zoom(key==='-'?.8:1.25);return;}
    const theta=orbit.getAzimuthalAngle()+({ArrowLeft:-.18,ArrowRight:.18}[key]||0);
    const phi=Math.min(Math.PI-.02,Math.max(.02,orbit.getPolarAngle()+({ArrowUp:-.15,ArrowDown:.15}[key]||0)));
    const delta=new Vector3().setFromSphericalCoords(camera.position.distanceTo(orbit.target),phi,theta);
    camera.position.copy(orbit.target).add(delta);orbit.update();
  });
  let down;
  canvas.addEventListener('pointerdown',e=>{down=e.isPrimary&&e.button===0?[e.clientX,e.clientY]:null;});
  canvas.addEventListener('pointercancel',()=>{down=null;});
  canvas.addEventListener('pointerup',e=>{
    if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;
    down=null;
    const r=canvas.getBoundingClientRect();
    raycaster.setFromCamera(new Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);
    const hits=raycaster.intersectObjects(surfaces.filter(s=>s.owner.visible).map(s=>s.mesh),false);
    if(hits.length)select(hits[0].object.userData.inspectKey,false);
  });
  const release=object=>object.traverse(n=>{
    if(n.isMesh){n.geometry.dispose();for(const m of [n.material].flat())m.dispose();}
  });
  new GLTFLoader().load(new URL('./models/'+family+'.glb',import.meta.url).href,gltf=>{
    if(gone){release(gltf.scene);return;}
    model=gltf.scene;
    model.traverse(node=>{
      if(!node.userData.part)return;
      const {part:key,split:[x,y,z],cover}=node.userData;
      nodes.push({node,key,base:node.position.clone(),offset:new Vector3(x,z,-y),cover});
      node.traverse(mesh=>{
        if(!mesh.isMesh)return;
        materials.add(mesh.material);geometries.add(mesh.geometry);
        const material=mesh.material.clone();
        mesh.material=material;
        material.metalness=Math.min(.40,material.metalness);
        mesh.userData.inspectKey=key;
        surfaces.push({mesh,key,owner:node,material,color:material.color.clone()});
      });
    });
    scene.add(model);
    status.hidden=true;
    apply(true,true);
  },undefined,()=>{if(!gone)failure('The model could not load. Reload the page to try again, or return to the lesson drawing.');});
  return ()=>{
    gone=true;cancelAnimationFrame(movement);observer.disconnect();orbit.dispose();host.removeEventListener('click',control);
    for(const g of geometries)g.dispose();
    for(const m of materials)m.dispose();
    for(const s of surfaces)s.material.dispose();
    renderer.dispose();renderer.forceContextLoss();
  };
}
