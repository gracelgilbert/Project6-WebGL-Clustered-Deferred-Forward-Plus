import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredRenderer from './renderers/clustered';
import Scene from './scene';

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const CLUSTERED = 'Clustered';

const params = {
  renderer: CLUSTERED,
  _renderer: null,
  shine: 5,
  specularPower: 30.0,
  specular: false,
  toon: false,
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer();
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(15, 15, 15);
      break;
    case CLUSTERED:
      params._renderer = new ClusteredRenderer(15, 15, 15);
      break;
  }
}

gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED]).onChange(setRenderer);
gui.add(params, 'shine', 0, 50).step(1);
gui.add(params, 'specularPower', 0.0, 50.0).step(1.0);
gui.add(params, 'specular');
gui.add(params, 'toon');



const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');
scene.setShine(params.shine);

camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
gl.enable(gl.DEPTH_TEST);

function render() {
  scene.update();
  scene.setShine(params.shine);
  scene.setPower(params.specularPower);
  scene.setSpecular(params.specular);
  scene.setToon(params.toon);
  params._renderer.render(camera, scene);
}

makeRenderLoop(render)();