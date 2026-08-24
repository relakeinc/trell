"use client";

import { useEffect, useRef } from "react";

const VERT = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAG = `
  precision mediump float;
  uniform vec2 u_resolution;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.0 + vec2(100.0);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 p = (uv - 0.5) * 2.0;
    float r = length(p);

    // fade to transparent outside the sphere
    if (r > 0.95) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }

    // sphere mask (soft edge)
    float sphere = smoothstep(0.98, 0.88, r);

    // landmass noise (continents)
    float land = fbm(p * 3.0 + 10.0);
    float cont = smoothstep(0.45, 0.55, land);

    // dot grid on the sphere
    float gridSize = 6.0;
    vec2 cell = floor((uv + p * 0.35) * u_resolution / gridSize);
    vec2 center = (cell + 0.5) * gridSize;
    float dist = length(gl_FragCoord.xy - center);

    float dotRadius = gridSize * 0.3 + cont * gridSize * 0.18;
    float dot = 1.0 - smoothstep(dotRadius - 0.6, dotRadius + 0.6, dist);

    // dots only where both sphere + (always visible, denser on land)
    float density = mix(0.55, 0.95, cont);

    float alpha = dot * sphere * density;

    // slight radial shading so it reads as a globe
    float shade = 1.0 - 0.25 * r;

    gl_FragColor = vec4(vec3(1.0) * shade, alpha);
  }
`;

function initGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", {
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
  });
  if (!gl) return null;

  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  function compile(type: number, src: string) {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
      console.error(gl!.getShaderInfoLog(s));
      gl!.deleteShader(s);
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return null;
  }

  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const aPos = gl.getAttribLocation(prog, "a_position");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  return {
    gl,
    uResolution: gl.getUniformLocation(prog, "u_resolution"),
  };
}

export function ShaderBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = initGL(canvas);
    if (!ctx) return;

    const { gl, uResolution } = ctx;
    let raf: number;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = canvas!.clientWidth * dpr;
      canvas!.height = canvas!.clientHeight * dpr;
      gl.viewport(0, 0, canvas!.width, canvas!.height);
    }

    function frame() {
      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uResolution, canvas!.width, canvas!.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    }

    frame();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 80%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
