import { Application, Container, Graphics } from "pixi.js";
// Pixi’s static sync functions support the site CSP without dynamic code generation.
import "pixi.js/unsafe-eval";
import type { GameView } from "./types.ts";

/** The rendered room supports the DOM object controls; the controls also work alone. */
export async function mountRoom(element: HTMLElement): Promise<{
  update(view: GameView): void;
  destroy(): void;
}> {
  const app = new Application();
  await app.init({
    width: Math.max(1, element.clientWidth),
    height: Math.max(1, element.clientHeight),
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    autoStart: false,
    preference: "webgl",
  });
  app.canvas.setAttribute("aria-hidden", "true");
  app.canvas.setAttribute("role", "presentation");
  element.append(app.canvas);
  const scene = new Container();
  app.stage.addChild(scene);
  let current: GameView | undefined;
  let destroyed = false;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function draw() {
    if (destroyed) return;
    for (const child of scene.removeChildren()) child.destroy();
    const w = 760;
    const h = (app.screen.height / app.screen.width) * w;
    scene.scale.set(app.screen.width / w);
    const floor = h * 0.66;
    const day = Math.max(1, Math.min(3, current?.day || 1));
    const evening = day === 3;
    const wall = [0xe9caa0, 0xdfbb91, 0xb8a3a2][day - 1] ?? 0xe9caa0;
    const ink = 0x352a3b;
    const g = new Graphics();
    scene.addChild(g);
    const polygon = (points: number[], color: number, alpha = 1) =>
      g.poly(points).fill({ color, alpha });
    const rect = (x: number, y: number, width: number, height: number, color: number) =>
      g.rect(x, y, width, height).fill(color);
    const oval = (x: number, y: number, rx: number, ry: number, color: number, alpha = 1) =>
      g.ellipse(x, y, rx, ry).fill({ color, alpha });

    rect(0, 0, w, h, 0x453441);
    polygon([57, 18, 703, 18, 690, floor, 69, floor], wall);
    polygon([69, floor, 690, floor, 760, h, 0, h], 0x9b6557);
    // Uneven seams and flecks evoke printed paper without a texture download.
    for (let i = 0; i < 420; i++) {
      const x = ((i * 127 + 31) % 653) + 54;
      const y = ((i * 197 + 17) % 997) * (h / 997);
      g.circle(x, y, i % 4 === 0 ? 1.3 : 0.65).fill({ color: ink, alpha: 0.055 });
    }
    polygon([57, 18, 114, 45, 115, floor, 69, floor], 0xc69a7e);
    rect(113, floor - 8, 577, 9, 0x78544e);
    for (let i = 0; i < 8; i++) {
      const x = 25 + i * 104;
      g.moveTo(380 + (x - 380) * 0.7, floor + 10)
        .lineTo(x, h)
        .stroke({ color: 0x704b49, width: 2, alpha: 0.5 });
    }

    // A high window puts a different piece of daylight across each day.
    const wy = Math.max(45, floor * 0.16);
    rect(141, wy, 168, floor * 0.45, 0x71554e);
    rect(150, wy + 9, 150, floor * 0.45 - 18, evening ? 0x748895 : 0xa5c3bc);
    polygon(
      [
        151,
        wy + floor * 0.45 - 10,
        299,
        wy + floor * 0.45 - 10,
        520 - day * 48,
        floor + h * 0.19,
        176,
        floor + h * 0.15,
      ],
      evening ? 0xc5b5ac : 0xffdfa4,
      evening ? 0.12 : 0.32,
    );
    rect(219, wy + 8, 8, floor * 0.45 - 16, 0x77584d);
    rect(150, wy + floor * 0.21, 150, 7, 0x77584d);
    polygon([128, wy - 8, 167, wy - 8, 173, wy + floor * 0.47, 133, wy + floor * 0.49], 0xeedcc0);
    polygon([287, wy - 8, 324, wy - 8, 322, wy + floor * 0.48, 279, wy + floor * 0.46], 0xeedcc0);
    for (const x of [139, 151, 298, 311]) {
      g.moveTo(x, wy)
        .lineTo(x + 3, wy + floor * 0.43)
        .stroke({ color: 0xc6ad94, width: 2 });
    }

    // A clock and a small shelf are ordinary objects, never a portrait of Kemal.
    oval(492, wy + 21, 32, 34, 0x725648);
    oval(492, wy + 20, 25, 27, 0xe8d4b0);
    g.moveTo(492, wy + 2)
      .lineTo(492, wy + 20)
      .lineTo(506, wy + 27)
      .stroke({ color: ink, width: 3 });
    rect(426, floor * 0.48, 132, 10, 0x785148);
    rect(443, floor * 0.48 - 25, 42, 25, 0xa35342);
    rect(490, floor * 0.48 - 18, 49, 18, 0x8a9290);

    // The kilim anchors the composition, including in the narrow mobile crop.
    const rugTop = floor + (h - floor) * 0.12;
    const rugBottom = h - Math.max(24, h * 0.07);
    polygon([202, rugTop, 582, rugTop, 668, rugBottom, 114, rugBottom], 0x6d3d47);
    polygon(
      [220, rugTop + 10, 566, rugTop + 10, 641, rugBottom - 11, 143, rugBottom - 11],
      0xba6b51,
    );
    polygon(
      [240, rugTop + 20, 550, rugTop + 20, 612, rugBottom - 22, 173, rugBottom - 22],
      0x754850,
    );
    for (let row = 0; row < 3; row++) {
      const y = rugTop + 28 + ((rugBottom - rugTop - 52) * row) / 2;
      for (let col = 0; col < 5; col++) {
        const x = 259 + col * 63;
        const size = 11 + row * 3;
        polygon(
          [x, y - size, x + size, y, x, y + size, x - size, y],
          col % 2 ? 0xc99c72 : 0xd9bd91,
        );
        polygon([x, y - 4, x + 4, y, x, y + 4, x - 4, y], 0x7c494d);
      }
    }
    for (let i = 0; i < 30; i++) {
      const x = 118 + i * 18;
      g.moveTo(x, rugBottom)
        .lineTo(x - 3, rugBottom + 7)
        .stroke({ color: 0xd5b588, width: 2 });
    }

    // His chair stays empty. The folded cardigan makes the absence legible.
    const cy = floor - 46;
    oval(536, floor + 31, 99, 24, ink, 0.18);
    polygon([468, cy - 102, 567, cy - 109, 585, cy + 10, 459, cy + 10], 0x573f43);
    polygon([478, cy - 93, 556, cy - 97, 567, cy - 3, 470, cy - 3], 0x8c735f);
    polygon([463, cy - 8, 579, cy - 8, 591, cy + 37, 450, cy + 37], 0x9d8168);
    polygon([459, cy + 27, 584, cy + 27, 581, cy + 44, 459, cy + 44], 0x614a46);
    rect(448, cy - 18, 17, 65, 0x674b43);
    rect(577, cy - 23, 17, 65, 0x674b43);
    polygon([464, cy + 39, 475, cy + 39, 469, cy + 77, 458, cy + 77], 0x523d3c);
    polygon([569, cy + 39, 580, cy + 39, 590, cy + 73, 579, cy + 73], 0x523d3c);
    polygon([480, cy - 43, 522, cy - 47, 539, cy - 10, 485, cy - 3], 0x4f6461);
    g.moveTo(498, cy - 41)
      .lineTo(509, cy - 8)
      .stroke({ color: 0xa0a496, width: 2 });

    // Neighbours bring the food: a covered dish and a cloth on a low table.
    const ty = floor + 59;
    rect(286, ty + 10, 8, 39, 0x5e4440);
    rect(392, ty + 10, 8, 39, 0x5e4440);
    oval(343, ty + 7, 89, 27, 0x5d4240);
    oval(343, ty, 89, 25, 0xb08263);
    polygon([294, ty - 12, 351, ty - 16, 371, ty + 30, 315, ty + 27], 0xe5c8a2);
    oval(366, ty - 5, 35, 11, 0xe8d5b7);
    oval(366, ty - 9, 29, 12, 0x9a9b8b);
    oval(366, ty - 20, 5, 4, 0x6a716a);
    oval(305, ty - 9, 11, 5, 0xf1dfbe);
    polygon([299, ty - 25, 311, ty - 25, 309, ty - 10, 301, ty - 10], 0x984735);

    // Visitors are quiet cutouts. Their identities and words stay in the text.
    const people = (current?.people ?? []).filter((name) => !/kemal/i.test(name)).slice(0, 3);
    const subdued = /tired|quiet|heavy|rest|grief/i.test(current?.mood ?? "");
    people.forEach((name, index) => {
      const x = 176 + index * 53;
      const y = floor - 22 + index * 9;
      const color = [0x66675c, 0x816364, 0x636875][index] ?? ink;
      const tilt = (name.length % 3) - 1;
      oval(x, y + 54, 29, 8, ink, 0.12);
      oval(x + tilt * 2, y - 58, 13, 17, color);
      polygon(
        [x - 13, y - 42, x + 12, y - 42, x + 25, y + 33, x - 25, y + 33],
        color,
        subdued ? 0.8 : 1,
      );
      rect(x - 16, y + 30, 9, 23, color);
      rect(x + 7, y + 30, 9, 23, color);
    });

    // The foreground jambs make the viewer the person keeping the door open.
    polygon([0, 0, 61, 0, 73, h, 0, h], 0x3f3039);
    polygon([0, 0, 37, 0, 48, h, 0, h], 0x69483f);
    polygon([703, 0, 760, 0, 760, h, 687, h], 0x3f3039);
    polygon([722, 0, 760, 0, 760, h, 710, h], 0x785141);
    rect(0, 0, w, 18, 0x3d2f37);
    oval(728, h * 0.57, 5, 10, 0xc6a16b);
    if (current?.outcome !== undefined && current.outcome !== "playing") {
      polygon([0, 0, 118, 20, 132, h, 0, h], 0x61443e);
      rect(100, h * 0.57, 6, 20, 0xc6a16b);
    }
    app.render();
  }

  function resize() {
    if (destroyed) return;
    app.renderer.resize(Math.max(1, element.clientWidth), Math.max(1, element.clientHeight));
    draw();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(element);
  // Static paper scenes already honour reduced motion. Redraw on preference changes.
  motion.addEventListener("change", draw);
  draw();
  return {
    update(view) {
      current = view;
      draw();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      motion.removeEventListener("change", draw);
      app.destroy(true, { children: true });
    },
  };
}
