export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];

  uniform vec2 u_dimensions;
  uniform mat4 u_viewMat;
  uniform ivec3 u_numslices;
  uniform float u_near;
  uniform float u_far;
  uniform int u_shine;
  
  varying vec2 v_uv;
  
  uniform sampler2D u_clusterbuffer;
  uniform sampler2D u_lightbuffer;

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    float u = float(index + 1) / float(textureWidth + 1);
    int pixel = component / 4;
    float v = float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    int pixelComponent = component - pixel * 4;
    if (pixelComponent == 0) {
      return texel[0];
    } else if (pixelComponent == 1) {
      return texel[1];
    } else if (pixelComponent == 2) {
      return texel[2];
    } else if (pixelComponent == 3) {
      return texel[3];
    }
  }

  Light UnpackLight(int index) {
    Light light;
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.0));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.5));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

    light.color = v2.rgb;
    return light;
  }

  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }


  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv); // position, normal x
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv); // albedo, normal y
    //vec4 gb2 = texture2D(u_gbuffers[2], v_uv); // albedo

    vec3 pos = gb0.xyz;
    vec3 albedo = gb1.xyz;
    vec3 nor = normalize(vec3(gb0.w, gb1.w,
                    sqrt(1.0 - gb0.w * gb0.w - gb1.w * gb1.w)));
   

    vec3 fragColor = vec3(0.0);



    vec3 fragPos = vec3(gl_FragCoord.x / u_dimensions.x, 
      gl_FragCoord.y / u_dimensions.y, 
      gl_FragCoord.z * gl_FragCoord.w);

    // Get 3D grid coordinates of cluster
    vec4 viewPos = u_viewMat * vec4(pos, 1.0);
    int gridx = int(float(u_numslices.x) * fragPos.x);
    int gridy = int(float(u_numslices.y) * fragPos.y);
    int gridz = int((-viewPos.z - u_near) * float(u_numslices.z) / (u_far - u_near));

    // Convert 3D grid coordinates into 1D index
    int index = gridx + gridy * u_numslices.x + gridz * u_numslices.x * u_numslices.y;

    int numclusters = u_numslices.x * u_numslices.y * u_numslices.z;
    int textureHeight = int(ceil(float(${params.numLights} + 1) / 4.0));

    // Get number of lights in cluster
    float u = float(index + 1) /  float(numclusters + 1);
    int clusterNumLights = int(texture2D(u_clusterbuffer, vec2(u, 0)).x);




    for (int i = 0; i < ${params.numLights}; ++i) {
      if (i >= clusterNumLights) {
        break;
      }
      int lightIndex = int(ExtractFloat(u_clusterbuffer, numclusters, textureHeight, index, i + 1));

      Light light = UnpackLight(lightIndex);
      float lightDistance = distance(light.position, pos);
      vec3 L = (light.position - pos) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, nor), 0.0);

       float reflectiveTerm = float(u_shine) * pow(abs(dot(normalize(nor), normalize(L))), 30.0);
      //float reflectiveTerm = 0.0;

      fragColor += albedo * (lambertTerm + reflectiveTerm) * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
    float intensity = 0.2126 * fragColor.x + 0.7152 * fragColor.y + 0.0722 * fragColor.z;
    if (intensity > 0.95) {
      return;
    } else if (intensity > 0.4) {
      gl_FragColor *= vec4(vec3(0.8), 1.0);
    } else if (intensity > 0.25) {
      gl_FragColor *= vec4(vec3(0.5), 1.0);
    } else if (intensity > 0.1) {
      gl_FragColor *= vec4(vec3(0.1), 1.0);
    } else {
      gl_FragColor *= vec4(vec3(0.05), 1.0);
    }
    //gl_FragColor = vec4(fragColor, 1.0);



  
    // gl_FragColor = gb2 * abs(dot(gb1, gb0));
    // gl_FragColor = vec4(float(u_numslices.x), 0.0, 0.0, 1.0);
  }
  `;
}