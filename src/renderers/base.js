import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS, LIGHT_RADIUS } from '../scene';
import {vec4, vec3} from 'gl-matrix';
import { ENABLE_SIMD } from 'gl-matrix/src/gl-matrix/common';

export const MAX_LIGHTS_PER_CLUSTER = 100;
const PI = 3.141592653589793;

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

    let halfFrustumHeight = Math.tan(camera.fov * PI /  360);
    let frustumHeight = 2 * halfFrustumHeight;
    let frustumWidth = camera.aspect * frustumHeight;
    let frustumDepth = camera.far - camera.near;

    let strideX = frustumWidth / this._xSlices;
    let strideY = frustumHeight / this._ySlices;
    let strideZ = frustumDepth / this._zSlices;

    let xStart = -(frustumWidth) / 2;
    let yStart = -(halfFrustumHeight);

    for (let l = 0; l < NUM_LIGHTS; ++l) {
      // Extract light information
      let currLight = scene.lights[l];
      let lightPos = vec4.fromValues(currLight.position[0], currLight.position[1], currLight.position[2], 1.0);
      let lightRadius = currLight.radius;

      // Transform light position into view space and convert to vec3
      let viewLightPos = vec4.create();
      vec4.transformMat4(viewLightPos, lightPos, viewMatrix);
      let viewLightPos3 = vec3.fromValues(viewLightPos[0], viewLightPos[1], -viewLightPos[2]);

      let minClusterX = 0;
      let maxClusterX = this._xSlices;
 
      for (let x = 0; x <= this._xSlices; ++x) {
        let currSlice = xStart + x * strideX;
        let normal = vec3.fromValues(cos_atan(currSlice), 0, -sin_atan(currSlice));
        let dotProduct = vec3.dot(viewLightPos3, normal);
        if (dotProduct < lightRadius) {
          minClusterX = Math.max(x - 1, 0);
          break;
        }
      }
      for (let x = minClusterX; x <= this._xSlices; ++x) {
        let currSlice = xStart + x * strideX;
        let normal = vec3.fromValues(cos_atan(currSlice), 0, -sin_atan(currSlice));
        let dotProduct = vec3.dot(viewLightPos3, normal);

        if (dotProduct < -lightRadius) {
          maxClusterX = x;
          break;
        }
      }

      let minClusterY = 0;
      let maxClusterY = this._ySlices;

      for (let y = 0; y <= this._ySlices; ++y) {
        let currSlice = yStart + y * strideY;
        let normal = vec3.fromValues(0, cos_atan(currSlice), -sin_atan(currSlice));
        let dotProduct = vec3.dot(viewLightPos3, normal);
        if (dotProduct < lightRadius) {
          minClusterY = Math.max(y - 1, 0);
          break;
        }
      }
      for (let y = minClusterY; y <= this._ySlices; ++y) {
        let currSlice = yStart + y * strideY;
        let normal = vec3.fromValues(0, cos_atan(currSlice), -sin_atan(currSlice));
        let dotProduct = vec3.dot(viewLightPos3, normal);
        if (dotProduct < -lightRadius) {
          maxClusterY = y;
          break;
        }
      }



      let minClusterZ = (viewLightPos3[2] - lightRadius - camera.near) / strideZ;
      let maxClusterZ = (viewLightPos3[2] + lightRadius - camera.near) / strideZ;

      minClusterZ = Math.floor(minClusterZ);
      maxClusterZ = Math.ceil(maxClusterZ);

      if (minClusterZ > this._zSlices || maxClusterZ < 0) {
        continue;
      }
      minClusterZ = Math.max(minClusterZ, 0);
      maxClusterZ = Math.min(maxClusterZ, this._zSlices);



      for (let x = minClusterX; x < maxClusterX; ++x) {
        for (let y = minClusterY; y < maxClusterY; ++y) {
          for (let z = minClusterZ; z < maxClusterZ; ++z) {
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let numLights = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
            if (numLights < MAX_LIGHTS_PER_CLUSTER) {
              numLights++;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = numLights;
              let row = Math.floor(numLights / 4.0);
              let component = numLights - row * 4;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, row) + component] = l;
            }
          }
        }
      }
    }
    this._clusterTexture.update();
  }
}