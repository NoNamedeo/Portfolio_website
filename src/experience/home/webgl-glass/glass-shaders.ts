export const glassVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vViewPosition;

  uniform float uCurvature;

  void main() {
    vUv = uv;
    vec3 transformed = position;
    vec2 centered = uv - 0.5;
    transformed.z += (1.0 - dot(centered, centered) * 2.15) * uCurvature;
    vec4 modelViewPosition = modelViewMatrix * vec4(transformed, 1.0);
    vViewPosition = -modelViewPosition.xyz;
    gl_Position = projectionMatrix * modelViewPosition;
  }
`;

export const glassFragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  varying vec3 vViewPosition;

  uniform sampler2D uBackdropTexture;
  uniform sampler2D uTextTexture;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uTime;
  uniform float uVelocity;
  uniform float uHover;
  uniform float uTextMix;
  uniform float uRefractionStrength;
  uniform float uChromaticAberration;
  uniform float uHoverRadius;
  uniform float uGlowIntensity;
  uniform float uRippleStrength;
  uniform float uRoughness;
  uniform float uThickness;
  uniform float uEdgeBrightness;
  uniform float uWaveStrength;
  uniform float uPaneRadius;
  uniform vec4 uPaneRects[7];
  uniform float uPaneRotations[7];
  uniform vec4 uRipple;
  uniform vec4 uTrail[6];

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float valueNoise(vec2 point) {
    vec2 index = floor(point);
    vec2 fraction = fract(point);
    fraction = fraction * fraction * (3.0 - 2.0 * fraction);
    return mix(
      mix(hash21(index), hash21(index + vec2(1.0, 0.0)), fraction.x),
      mix(hash21(index + vec2(0.0, 1.0)), hash21(index + vec2(1.0)), fraction.x),
      fraction.y
    );
  }

  float roundedPaneDistance(vec2 uv, vec4 pane, float rotation, float radius) {
    vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
    vec2 localPoint = (uv - pane.xy) * aspect;
    float cosine = cos(rotation);
    float sine = sin(rotation);
    localPoint = vec2(
      cosine * localPoint.x - sine * localPoint.y,
      sine * localPoint.x + cosine * localPoint.y
    );
    vec2 halfSize = pane.zw * aspect;
    vec2 point = abs(localPoint) - halfSize + radius;
    return length(max(point, 0.0)) + min(max(point.x, point.y), 0.0) - radius;
  }

  float pointerField(vec2 uv, vec2 center, float radius) {
    vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
    float distanceToPointer = length((uv - center) * aspect);
    float normalizedDistance = distanceToPointer / max(radius, 0.001);
    return exp(-normalizedDistance * normalizedDistance * 2.8);
  }

  vec3 sampleChromatic(sampler2D textureSampler, vec2 uv, vec2 direction, float amount) {
    float red = texture2D(textureSampler, clamp(uv + direction * amount, 0.002, 0.998)).r;
    float green = texture2D(textureSampler, clamp(uv, 0.002, 0.998)).g;
    float blue = texture2D(textureSampler, clamp(uv - direction * amount, 0.002, 0.998)).b;
    return vec3(red, green, blue);
  }

  void main() {
    float roundedDistance = 100.0;
    for (int index = 0; index < 7; index++) {
      roundedDistance = min(
        roundedDistance,
        roundedPaneDistance(vUv, uPaneRects[index], uPaneRotations[index], uPaneRadius)
      );
    }
    float glassMask = 1.0 - smoothstep(-0.006, 0.008, roundedDistance);
    if (glassMask <= 0.001) discard;

    vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
    vec2 pointerDelta = (vUv - uPointer) * aspect;
    float pointerDistance = max(length(pointerDelta), 0.0001);
    vec2 pointerDirection = pointerDelta / pointerDistance;
    float contact = pointerField(vUv, uPointer, uHoverRadius) * uHover;

    float trailField = 0.0;
    vec2 trailDirection = vec2(0.0);
    for (int index = 0; index < 6; index++) {
      float influence = uTrail[index].z * (1.0 - float(index) / 7.0);
      float field = pointerField(vUv, uTrail[index].xy, uHoverRadius * (0.86 + float(index) * 0.035));
      trailField += field * influence;
      trailDirection += normalize((vUv - uTrail[index].xy) * aspect + vec2(0.0001)) * field * influence;
    }
    trailField = min(trailField * 0.12, 0.54);

    float fineNoise = valueNoise(vUv * 23.0 + uTime * 0.035);
    float broadNoise = valueNoise(vUv * 5.2 - uTime * 0.018);
    float microNormal = (fineNoise - 0.5) * uRoughness;
    float idleWave = sin(vUv.x * 18.0 + vUv.y * 11.0 + uTime * 0.42) * uWaveStrength;

    float rippleAge = max(uTime - uRipple.z, 0.0);
    float rippleDistance = length((vUv - uRipple.xy) * aspect);
    float rippleRing = sin((rippleDistance - rippleAge * 0.19) * 92.0);
    rippleRing *= exp(-rippleAge * 2.5) * exp(-rippleDistance * 4.6) * uRipple.w;

    vec2 fieldDirection = pointerDirection * contact + trailDirection * 0.07;
    fieldDirection += vec2(
      sin((vUv.y + broadNoise) * 15.0 + uTime * 0.16),
      cos((vUv.x - broadNoise) * 13.0 - uTime * 0.13)
    ) * (idleWave + microNormal * 0.0022);
    fieldDirection += pointerDirection * rippleRing * uRippleStrength;

    float dynamicStrength = uRefractionStrength * (
      0.1 +
      contact * (0.64 + uVelocity * 0.25) +
      trailField * 0.2
    );
    vec2 refractionOffset = fieldDirection * dynamicStrength;
    vec2 refractedUv = clamp(vUv + refractionOffset, 0.002, 0.998);

    float aberrationAmount = uChromaticAberration * (
      contact * (0.45 + uVelocity * 0.8) +
      trailField * 0.28
    );
    vec3 backdrop = sampleChromatic(
      uBackdropTexture,
      refractedUv,
      normalize(fieldDirection + vec2(0.0001)),
      aberrationAmount
    );
    vec3 refractedText = sampleChromatic(
      uTextTexture,
      refractedUv,
      normalize(fieldDirection + vec2(0.0001)),
      aberrationAmount * 1.18
    );
    float textAlpha = texture2D(uTextTexture, refractedUv).a * uTextMix;

    float edgeDistance = abs(roundedDistance);
    float outerEdge = 1.0 - smoothstep(0.0, uThickness, edgeDistance);
    float innerEdge = smoothstep(0.0, uThickness * 1.8, edgeDistance)
      * (1.0 - smoothstep(uThickness * 1.8, uThickness * 4.2, edgeDistance));

    vec3 surfaceNormal = normalize(vec3(
      -fieldDirection.x * (0.8 + contact),
      -fieldDirection.y * (0.8 + contact),
      1.0 - contact * 0.08
    ));
    vec3 viewDirection = normalize(vec3((vUv - 0.5) * 0.54, 1.25));
    float fresnel = pow(1.0 - max(dot(surfaceNormal, viewDirection), 0.0), 2.35);

    float localGlow = contact * (0.38 + uVelocity * 0.34) * uGlowIntensity;
    vec3 warmHighlight = vec3(1.0, 0.78, 0.67) * localGlow;
    vec3 coolEdge = vec3(0.56, 0.70, 1.0) * fresnel * 0.25;
    vec3 edgeLight = mix(vec3(0.78, 0.86, 1.0), vec3(1.0, 0.86, 0.75), vUv.x);
    edgeLight *= (outerEdge * 0.72 + innerEdge * 0.18) * uEdgeBrightness;

    vec3 glassTint = mix(vec3(0.055, 0.065, 0.065), vec3(0.10, 0.115, 0.13), vUv.y);
    vec3 color = mix(backdrop, glassTint, 0.12 + uRoughness * 0.08);
    color = mix(color, refractedText, textAlpha);
    color += warmHighlight + coolEdge + edgeLight;
    color += vec3(1.0) * (fineNoise - 0.5) * 0.018;
    color += vec3(0.25, 0.34, 0.58) * trailField * uVelocity * 0.055;

    float bodyAlpha = 0.43 + contact * 0.08 + fresnel * 0.12;
    float alpha = glassMask * clamp(bodyAlpha + textAlpha * 0.53 + outerEdge * 0.2, 0.0, 0.97);
    gl_FragColor = vec4(color, alpha);
  }
`;
