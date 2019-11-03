import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS, LIGHT_RADIUS } from '../scene';
import {vec4, vec3} from 'gl-matrix';
import { ENABLE_SIMD } from 'gl-matrix/src/gl-matrix/common';

export const MAX_LIGHTS_PER_CLUSTER = 100;
const PI = 3.1415926535;

function sin_atan(angle) {
  return angle / Math.sqrt(1.0 + angle * angle);
}

function cos_atan(angle) {
  return 1.0 / Math.sqrt(1.0 + angle * angle);
}

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }
    for (let l = 0; l < NUM_LIGHTS; ++l) {
      let lightPos = vec4.fromValues(scene.lights[l].position[0], scene.lights[l].position[1], scene.lights[l].position[2], 1.0);
      let viewLightPos = vec4.create();
      vec4.transformMat4(viewLightPos, lightPos, viewMatrix);
      viewLightPos[2] *= -1.0;
      let lightPos3 = vec3.fromValues(viewLightPos[0], viewLightPos[1], viewLightPos[2]);
      let lightRadius = scene.lights[l].radius;


      let halfFrustumHeight = Math.tan(camera.fov * PI /  360.0);
      let frustumHeight = 2.0 * halfFrustumHeight;
      let frustumWidth = camera.aspect * frustumHeight;
      let frustumDepth = camera.far - camera.near;

      let strideX = frustumWidth / this._xSlices;
      let strideY = frustumHeight / this._ySlices;
      let strideZ = frustumDepth / this._zSlices;




      let minClusterZ = viewLightPos[2] - camera.near;
      let maxClusterZ = viewLightPos[2] - camera.near;
      minClusterZ /= strideZ;
      maxClusterZ /= strideZ;
      minClusterZ = Math.floor(minClusterZ - lightRadius);
      maxClusterZ = Math.ceil(maxClusterZ + lightRadius);
      // if (minClusterZ > this._zSlices) {
      //   break;
      // }
      // if (maxClusterZ < 0) {
      //   break;
      // }
      minClusterZ = Math.max(minClusterZ, 0);
      maxClusterZ = Math.min(maxClusterZ, this._zSlices);


      let minClusterX = 0;
      let maxClusterX = this._xSlices;
      let minClusterY = 0;
      let maxClusterY = this._ySlices;


      let xStart = -frustumWidth / 2.0;
      

      for (let i = 0; i <= this._xSlices; i++) {
        let currSlice = xStart + i * strideX;
        let normal = vec3.fromValues(cos_atan(currSlice), 0, -sin_atan(currSlice));
        let dotProduct = 0;
        vec3.dot(dotProduct, lightPos3, normal);
        if (dotProduct < lightRadius) {
          minClusterX = Math.max(0, i - 1);
          break;
        }
      }
      for (let i = minClusterX; i <= this._xSlices; i++) {
        let currSlice = xStart + i * strideX;
        let normal = vec3.fromValues(cos_atan(currSlice), 0, -sin_atan(currSlice));
        let dotProduct = 0;
        vec3.dot(dotProduct, lightPos3, normal);
        if (dotProduct < -lightRadius) {
          maxClusterX = Math.max(0, i - 1);
          break;
        }
      }


      let yStart = -halfFrustumHeight;

      for (let i = 0; i <= this._ySlices; i++) {
        let currSlice = yStart + i * strideY;
        let normal = vec3.fromValues(0, cos_atan(currSlice), -sin_atan(currSlice));
        let dotProduct = 0;
        vec3.dot(dotProduct, lightPos3, normal);
        if (dotProduct < lightRadius) {
          minClusterY = Math.max(0, i - 1);
          break;
        }
      }
      for (let i = minClusterY; i <= this._ySlices; i++) {
        let currSlice = yStart + i * strideY;
        let normal = vec3.fromValues(0, cos_atan(currSlice), -sin_atan(currSlice));
        let dotProduct = 0;
        vec3.dot(dotProduct, lightPos3, normal);
        if (dotProduct < -lightRadius) {
          maxClusterY = Math.max(0, i - 1);
          break;
        }
      }





      for (let x = minClusterX; x <= maxClusterX; ++x) {
        for (let y = minClusterY; y <= maxClusterY; ++y) {
          for (let z = minClusterZ; z <= maxClusterZ; ++z) {
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)]++;
            let numLights = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, numLights)] = l;
          }
        }
      }
    }
    this._clusterTexture.update();
  }
}