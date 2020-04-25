import rk4 from "ode-rk4";

// Adapted from the following source:
// <http://epirecip.es/epicookbook/chapters/sir/js>

export function simulate(f, t0, y0, step, tmax) {
  let integrator = rk4(y0, f, t0, step);
  let t = t0;
  const ta = [];
  const ya = [];

  ta.push(t0);
  ya.push({ ...y0 });

  while (true) {
    t += step;

    if (t > tmax)
      break;

    integrator = integrator.step();
    ya.push({ ...integrator.y });
    ta.push(t);
  }

  return { t: ta, y: ya };
}

const BETA = 0.1;
const GAMMA = 0.05;

export const sir = (b = BETA, g = GAMMA) => (dydt, y, t) => {
  dydt[0] = -b * y[0] * y[1];
  dydt[1] = (b * y[0] * y[1]) - (g * y[1]);
  dydt[2] = g * y[1];
};
