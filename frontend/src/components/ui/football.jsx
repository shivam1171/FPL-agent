/**
 * Football-flavoured primitives: an inline ball glyph, a bouncing loader, and
 * the login backdrop — a live canvas simulation of a match between a green and
 * a gray team. Decoration only — pointer-events-none, low alpha, endless.
 */
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/** Minimal football glyph: circle, centre pentagon, five seams, rim patches. */
export function FootballIcon({ size = 24, solid = false, className, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="1.6"
        fill={solid ? 'var(--card)' : 'none'}
      />
      <path
        d="M12 7.4 16.37 10.58 14.7 15.72 9.3 15.72 7.63 10.58Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        d="M12 7.4V4.2M16.37 10.58 19.42 9.59M14.7 15.72 16.58 18.31M9.3 15.72 7.42 18.31M7.63 10.58 4.58 9.59"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M15.42 2.6 19.88 5.84M21.99 12.35 20.29 17.59M14.76 21.61 9.24 21.61M3.71 17.59 2.01 12.35M4.12 5.84 8.58 2.6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Bouncing-ball loader with a squashing shadow. Geometry derives from `size`
 * so it works as a small inline spinner or a large centred page loader;
 * `stacked` puts the label underneath for the latter.
 */
export function BallLoader({ label, size = 18, stacked = false, className }) {
  return (
    <div
      className={cn('flex items-center', stacked ? 'flex-col gap-3' : 'gap-2.5', className)}
    >
      <span
        className="relative flex items-end justify-center"
        style={{ height: size * 2.1, width: size * 1.6 }}
        aria-hidden="true"
      >
        <FootballIcon solid size={size} className="animate-ball-bounce text-primary" />
        <span
          className="absolute bottom-0 animate-ball-shadow rounded-full bg-foreground/15"
          style={{ width: size, height: Math.max(3, Math.round(size / 6)) }}
        />
      </span>
      {label && (
        <span className={cn('text-muted-foreground', stacked ? 'text-sm' : 'text-xs')}>
          {label}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ *
 * The match simulation.
 *
 * A miniature engine on a 105×68 pitch (real proportions), scaled to cover
 * the viewport. Two 11-a-side teams:
 *   - every player steers toward a target with smooth arrive/damping, so all
 *     22 are in constant motion;
 *   - team shape slides with the ball; the side in possession pushes up, the
 *     defending side drops while its two nearest players hunt the carrier;
 *   - the carrier dribbles away from pressure and, on a short decision clock,
 *     picks the best-scored teammate (forward progress + open lane + range)
 *     or shoots when in range;
 *   - passes are led into the receiver's path and can be cut out by a body in
 *     the lane; keepers track the ball and smother what they can reach;
 *   - goals flash rings at the net, everyone sprints back for the kickoff,
 *     and the conceding side restarts. It never stops.
 * ------------------------------------------------------------------------ */

const PITCH_W = 105;
const PITCH_H = 68;
const GOAL_HALF = 7;
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// 4-3-3 anchors for a team attacking rightward; mirrored for the other side.
const HOME = [
  [6, 34],
  [20, 12], [18, 25], [18, 43], [20, 56],
  [38, 34], [40, 18], [40, 50],
  [66, 11], [70, 34], [66, 57],
];

function makeTeam(dir) {
  return HOME.map(([x, y], i) => ({
    home: { x: dir === 1 ? x : PITCH_W - x, y },
    pos: { x: dir === 1 ? x : PITCH_W - x, y },
    vel: { x: 0, y: 0 },
    speed: i === 0 ? 10 : 8.2 + (i > 7 ? 1 : 0) + rand(-0.5, 0.5),
    keeper: i === 0,
    dir,
  }));
}

function createMatch() {
  const green = makeTeam(1);
  const gray = makeTeam(-1);
  const carrier = green[6];
  return {
    green,
    gray,
    all: [...green, ...gray],
    ball: {
      pos: { ...carrier.pos },
      vel: { x: 0, y: 0 },
      owner: carrier,
      receiver: null,
      lastDir: 1,
      noTouch: null,
      noTouchUntil: 0,
    },
    decideAt: 0.8,
    stat: { passes: 0, completed: 0, goals: 0, outs: 0 },
    t: 0,
    goalFlash: null,
    resetUntil: 0,
    kickoffTeam: null,
  };
}

function steer(p, target, dt, speedScale = 1) {
  const dx = target.x - p.pos.x;
  const dy = target.y - p.pos.y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = p.speed * speedScale * Math.min(1, d / 3);
  const k = 1 - Math.exp(-5 * dt);
  p.vel.x += ((dx / d) * speed - p.vel.x) * k;
  p.vel.y += ((dy / d) * speed - p.vel.y) * k;
  p.pos.x += p.vel.x * dt;
  p.pos.y += p.vel.y * dt;
}

function nearestOpponent(m, p) {
  const opps = p.dir === 1 ? m.gray : m.green;
  let best = null;
  let bd = Infinity;
  for (const o of opps) {
    const d = dist(o.pos, p.pos);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return [best, bd];
}

function laneBlocked(m, from, to, attackDir) {
  const opps = attackDir === 1 ? m.gray : m.green;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len2 = dx * dx + dy * dy || 1;
  for (const o of opps) {
    const t = ((o.pos.x - from.x) * dx + (o.pos.y - from.y) * dy) / len2;
    if (t <= 0.08 || t >= 0.92) continue;
    const px = from.x + dx * t;
    const py = from.y + dy * t;
    if (Math.hypot(o.pos.x - px, o.pos.y - py) < 3.4) return true;
  }
  return false;
}

const goalOf = (dir) => ({ x: dir === 1 ? PITCH_W : 0, y: PITCH_H / 2 });

/* Every release marks its kicker untouchable for a beat — the root fix for
 * keepers instantly recapturing their own clearances. */
function release(m, kicker) {
  m.ball.owner = null;
  m.ball.noTouch = kicker;
  m.ball.noTouchUntil = m.t + 0.6;
}

function updateMatch(m, dt) {
  m.t += dt;
  const { ball } = m;
  const resetting = m.t < m.resetUntil;

  // ---- players ----
  for (const p of m.all) {
    const team = p.dir === 1 ? m.green : m.gray;
    const attacking = !!ball.owner && ball.owner.dir === p.dir;

    if (ball.owner === p) continue; // the carrier moves in the ball section

    if (p.keeper) {
      const gx = p.dir === 1 ? 3 : PITCH_W - 3;
      const gy =
        PITCH_H / 2 +
        Math.max(-GOAL_HALF, Math.min(GOAL_HALF, (ball.pos.y - PITCH_H / 2) * 0.75));
      steer(p, { x: gx, y: gy }, dt);
      continue;
    }

    if (resetting) {
      steer(p, p.home, dt, 1.25); // everyone sprints back for the kickoff
      continue;
    }

    if (!attacking) {
      // The two nearest defenders hunt the ball; one presses, one covers.
      const mates = team.filter((q) => !q.keeper);
      const byDist = [...mates].sort(
        (a, b) => dist(a.pos, ball.pos) - dist(b.pos, ball.pos)
      );
      if (p === byDist[0]) {
        if (ball.owner && ball.owner.keeper) {
          // No tackling keepers: hold the edge of the box instead.
          const k = ball.owner.pos;
          const cd = Math.hypot(PITCH_W / 2 - k.x, PITCH_H / 2 - k.y) || 1;
          steer(
            p,
            {
              x: k.x + ((PITCH_W / 2 - k.x) / cd) * 10,
              y: k.y + ((PITCH_H / 2 - k.y) / cd) * 10,
            },
            dt,
            1.05
          );
        } else {
          steer(p, ball.pos, dt, 1.3);
        }
        continue;
      }
      if (p === byDist[1]) {
        const own = goalOf(-p.dir);
        steer(
          p,
          { x: (ball.pos.x + own.x) / 2, y: (ball.pos.y + own.y) / 2 },
          dt,
          1.05
        );
        continue;
      }
    } else if (ball.receiver === p) {
      // Run onto the pass.
      steer(
        p,
        { x: ball.pos.x + ball.vel.x * 0.25, y: ball.pos.y + ball.vel.y * 0.25 },
        dt,
        1.25
      );
      continue;
    }

    // Team shape slides with the ball; attackers push on, defenders drop.
    const push = attacking ? p.dir * 11 : p.dir * -8;
    const tx = Math.max(
      3,
      Math.min(PITCH_W - 3, p.home.x + (ball.pos.x - PITCH_W / 2) * 0.3 + push)
    );
    const ty = Math.max(
      3,
      Math.min(PITCH_H - 3, p.home.y + (ball.pos.y - PITCH_H / 2) * 0.22)
    );
    // A pinch of wander so nobody ever stands still.
    steer(
      p,
      {
        x: tx + Math.sin(m.t * 1.3 + p.home.y) * 2.2,
        y: ty + Math.cos(m.t * 1.1 + p.home.x) * 2.2,
      },
      dt
    );
  }

  // ---- ball ----
  if (ball.owner) {
    const p = ball.owner;
    const goal = goalOf(p.dir);
    const [opp, od] = nearestOpponent(m, p);

    // Dribble: toward goal, bending away from the presser.
    let dx = goal.x - p.pos.x;
    let dy = goal.y - p.pos.y;
    let len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    if (opp && od < 9 && !p.keeper) {
      const ax = p.pos.x - opp.pos.x;
      const ay = p.pos.y - opp.pos.y;
      const al = Math.hypot(ax, ay) || 1;
      const w = (9 - od) / 9;
      dx += (ax / al) * w * 1.4;
      dy += (ay / al) * w * 1.4;
      len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
    }
    if (!resetting && !p.keeper) {
      steer(p, { x: p.pos.x + dx * 8, y: p.pos.y + dy * 8 }, dt, 0.95);
    }
    ball.pos.x = p.pos.x + dx * 1.4;
    ball.pos.y = p.pos.y + dy * 1.4;
    ball.vel.x = p.vel.x;
    ball.vel.y = p.vel.y;
    ball.lastDir = p.dir;

    if (!resetting && m.t >= m.decideAt) {
      m.decideAt = m.t + rand(0.6, 1.3);
      const team = p.dir === 1 ? m.green : m.gray;
      const gd = dist(p.pos, goal);
      const pressed = od < 5;

      if (p.keeper) {
        // Distribute: best available mate at any score, else clear it long.
        let best = null;
        let bestScore = -Infinity;
        for (const q of team) {
          if (q === p || q.keeper) continue;
          const d = dist(p.pos, q.pos);
          if (d < 8 || d > 48) continue;
          if (laneBlocked(m, p.pos, q.pos, p.dir)) continue;
          const [, qod] = nearestOpponent(m, q);
          const score = Math.min(qod, 12) + (q.pos.x - p.pos.x) * p.dir * 0.15 + rand(0, 2);
          if (score > bestScore) {
            bestScore = score;
            best = q;
          }
        }
        if (best) {
          const d = dist(ball.pos, best.pos) || 1;
          const speed = 17 + d * 0.65;
          m.stat.passes += 1;
          ball.vel.x = ((best.pos.x - ball.pos.x) / d) * speed;
          ball.vel.y = ((best.pos.y - ball.pos.y) / d) * speed;
          release(m, p);
          ball.receiver = best;
        } else {
          // Hoof it upfield.
          const ty = rand(10, PITCH_H - 10);
          const tx = p.pos.x + p.dir * 55;
          const d = Math.hypot(tx - ball.pos.x, ty - ball.pos.y) || 1;
          ball.vel.x = ((tx - ball.pos.x) / d) * 42;
          ball.vel.y = ((ty - ball.pos.y) / d) * 42;
          release(m, p);
          ball.receiver = null;
        }
        return;
      }

      // Shoot when in range — always when inside 16.
      if (gd < 22 && (gd < 10 || (pressed && gd < 16) || Math.random() < 0.1)) {
        const target = {
          x: goal.x,
          y: PITCH_H / 2 + rand(-GOAL_HALF * 0.9, GOAL_HALF * 0.9),
        };
        const d = dist(ball.pos, target) || 1;
        ball.vel.x = ((target.x - ball.pos.x) / d) * 56;
        ball.vel.y = ((target.y - ball.pos.y) / d) * 56;
        release(m, p);
        ball.receiver = null;
        return;
      }

      // Otherwise look for the best pass.
      let best = null;
      let bestScore = pressed ? -4 : 2.5;
      for (const q of team) {
        if (q === p || q.keeper) continue;
        const d = dist(p.pos, q.pos);
        if (d < 6 || d > 38) continue;
        if (laneBlocked(m, p.pos, q.pos, p.dir)) continue;
        const forward = (q.pos.x - p.pos.x) * p.dir;
        const [, qod] = nearestOpponent(m, q);
        const score =
          forward * 0.35 +
          Math.min(qod, 12) * 1.05 -
          Math.abs(d - 15) * 0.22 +
          rand(0, 3);
        if (score > bestScore) {
          bestScore = score;
          best = q;
        }
      }
      if (best) {
        const lead = {
          x: best.pos.x + best.vel.x * 0.2,
          y: best.pos.y + best.vel.y * 0.2,
        };
        const d = dist(ball.pos, lead) || 1;
        const speed = 15 + d * 0.65;
        m.stat.passes += 1;
        ball.vel.x = ((lead.x - ball.pos.x) / d) * speed;
        ball.vel.y = ((lead.y - ball.pos.y) / d) * speed;
        release(m, p);
        ball.receiver = best;
      }
    }
  } else {
    // In flight or loose. A targeted pass keeps its pace and seeks its man;
    // a loose ball dies quickly.
    ball.pos.x += ball.vel.x * dt;
    ball.pos.y += ball.vel.y * dt;
    const fr = Math.exp((ball.receiver ? -0.5 : -1.4) * dt);
    ball.vel.x *= fr;
    ball.vel.y *= fr;

    if (ball.receiver) {
      const r = ball.receiver;
      const d = dist(ball.pos, r.pos) || 1;
      ball.vel.x += ((r.pos.x - ball.pos.x) / d) * 48 * dt;
      ball.vel.y += ((r.pos.y - ball.pos.y) / d) * 48 * dt;
      // A pass that has run out of pace becomes a loose ball.
      if (Math.hypot(ball.vel.x, ball.vel.y) < 2) ball.receiver = null;
    }

    const speed = Math.hypot(ball.vel.x, ball.vel.y);

    // Goals.
    if (
      (ball.pos.x <= 1 || ball.pos.x >= PITCH_W - 1) &&
      Math.abs(ball.pos.y - PITCH_H / 2) <= GOAL_HALF
    ) {
      const scoredOnLeft = ball.pos.x <= 1;
      m.stat.goals += 1;
      m.goalFlash = { x: scoredOnLeft ? 0 : PITCH_W, y: ball.pos.y, t: m.t };
      m.resetUntil = m.t + 2.2;
      m.kickoffTeam = scoredOnLeft ? m.green : m.gray; // conceding side restarts
      ball.pos = { x: PITCH_W / 2, y: PITCH_H / 2 };
      ball.vel = { x: 0, y: 0 };
      ball.owner = null;
      ball.receiver = null;
      return;
    }

    // Out of play: the ball dies on the line and the other side restarts —
    // the nearest opposing outfielder runs over to take it.
    if (
      ball.pos.x < 0.5 ||
      ball.pos.x > PITCH_W - 0.5 ||
      ball.pos.y < 0.5 ||
      ball.pos.y > PITCH_H - 0.5
    ) {
      ball.pos.x = Math.max(0.5, Math.min(PITCH_W - 0.5, ball.pos.x));
      ball.pos.y = Math.max(0.5, Math.min(PITCH_H - 0.5, ball.pos.y));
      ball.vel.x = 0;
      ball.vel.y = 0;
      m.stat.outs += 1;
      const takers = (ball.lastDir === 1 ? m.gray : m.green).filter((q) => !q.keeper);
      let taker = takers[0];
      let bd = Infinity;
      for (const q of takers) {
        const d = dist(q.pos, ball.pos);
        if (d < bd) {
          bd = d;
          taker = q;
        }
      }
      ball.owner = null;
      ball.receiver = taker;
    }

    // Control: the first body close to a controllable ball takes it —
    // the receiver's first touch, or a defender cutting the lane.
    if (!m.kickoffTeam) {
      for (const p of m.all) {
        if (p === ball.noTouch && m.t < ball.noTouchUntil) continue;
        const d = dist(p.pos, ball.pos);
        const isReceiver = p === ball.receiver;
        // A targeted pass belongs to its receiver: others may only truly
        // intercept the flight or smother it as a keeper. A loose ball
        // belongs to whoever gets there.
        const takes = isReceiver
          ? d < 3
          : p.keeper
            ? d < 2.2
            : ball.receiver
              ? d < 0.9 && p.dir !== ball.receiver.dir
              : speed < 8 && d < 1.6;
        if (takes) {
          if (isReceiver) m.stat.completed += 1;
          ball.owner = p;
          ball.lastDir = p.dir;
          ball.receiver = null;
          m.decideAt = m.t + (p.keeper ? rand(0.25, 0.5) : rand(0.35, 0.9));
          break;
        }
      }
    } else if (m.t >= m.resetUntil) {
      // Kickoff: hand the ball to the restarting side's midfielder.
      const mid = m.kickoffTeam[5];
      mid.pos = { x: PITCH_W / 2 + (mid.dir === 1 ? -1.5 : 1.5), y: PITCH_H / 2 };
      ball.owner = mid;
      m.kickoffTeam = null;
      m.decideAt = m.t + 0.8;
    }
  }
}

/* ---- rendering ---- */

function resolveColors() {
  const css = getComputedStyle(document.documentElement);
  const dark = document.documentElement.classList.contains('dark');
  return {
    fg: css.getPropertyValue('--foreground').trim() || '#1f2937',
    primary: css.getPropertyValue('--primary').trim() || '#199a63',
    card: css.getPropertyValue('--card').trim() || '#ffffff',
    // A calm, near-neutral turf — quieter than the UI's pitch token.
    pitch: dark ? 'oklch(0.19 0.022 156)' : 'oklch(0.963 0.014 152)',
  };
}

function drawMatch(ctx, m, view, colors, trail) {
  const { w, h, sx, sy } = view;
  const s = (sx + sy) / 2;
  ctx.clearRect(0, 0, w, h);
  const X = (x) => x * sx;
  const Y = (y) => y * sy;

  // The field fills the window.
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.pitch;
  ctx.fillRect(0, 0, w, h);

  // Markings. The window edge is the touchline, so no outer rectangle.
  ctx.strokeStyle = colors.fg;
  ctx.globalAlpha = 0.14;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(X(PITCH_W / 2), 0);
  ctx.lineTo(X(PITCH_W / 2), h);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(X(PITCH_W / 2), Y(PITCH_H / 2), 9.15 * sx, 9.15 * sy, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(X(0), Y(PITCH_H / 2 - 20), 16.5 * sx, 40 * sy);
  ctx.strokeRect(X(PITCH_W - 16.5), Y(PITCH_H / 2 - 20), 16.5 * sx, 40 * sy);
  ctx.strokeRect(X(0), Y(PITCH_H / 2 - 9.16), 5.5 * sx, 18.32 * sy);
  ctx.strokeRect(X(PITCH_W - 5.5), Y(PITCH_H / 2 - 9.16), 5.5 * sx, 18.32 * sy);
  ctx.fillStyle = colors.fg;
  for (const spot of [PITCH_W / 2, 11, PITCH_W - 11]) {
    ctx.beginPath();
    ctx.arc(X(spot), Y(PITCH_H / 2), 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Goals: an unmistakable frame — bright mouth line and solid post caps.
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = colors.fg;
  ctx.lineWidth = 6;
  for (const gx of [3, w - 3]) {
    ctx.beginPath();
    ctx.moveTo(gx, Y(PITCH_H / 2 - GOAL_HALF));
    ctx.lineTo(gx, Y(PITCH_H / 2 + GOAL_HALF));
    ctx.stroke();
    ctx.fillStyle = colors.fg;
    for (const py of [PITCH_H / 2 - GOAL_HALF, PITCH_H / 2 + GOAL_HALF]) {
      ctx.beginPath();
      ctx.arc(gx, Y(py), 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Goal flash.
  if (m.goalFlash) {
    const age = m.t - m.goalFlash.t;
    if (age < 2.1) {
      for (let i = 0; i < 4; i++) {
        const a = age - i * 0.16;
        if (a < 0 || a > 1.3) continue;
        ctx.globalAlpha = 0.55 * (1 - a / 1.3);
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(X(m.goalFlash.x), Y(m.goalFlash.y), (2 + a * 22) * s, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      m.goalFlash = null;
    }
  }

  // Ball trail — only while the ball flies.
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    ctx.globalAlpha = 0.28 * (i / trail.length);
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Players: green solid, gray hollow — two teams at a glance.
  for (const p of m.all) {
    const r = p.keeper ? 7 : 6;
    ctx.beginPath();
    ctx.arc(X(p.pos.x), Y(p.pos.y), r, 0, Math.PI * 2);
    if (p.dir === 1) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = colors.primary;
      ctx.fill();
    } else {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = colors.fg;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Carrier ring.
  if (m.ball.owner) {
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(X(m.ball.owner.pos.x), Y(m.ball.owner.pos.y), 10.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // The ball: card-coloured core with a hard outline and a soft lift shadow —
  // the highest-contrast mark on the field, drawn above everything.
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(X(m.ball.pos.x), Y(m.ball.pos.y), 4.6, 0, Math.PI * 2);
  ctx.fillStyle = colors.card;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = colors.fg;
  ctx.lineWidth = 2.2;
  ctx.stroke();
}

export function PitchBackdrop({ className }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const match = createMatch();
    if (import.meta.env.DEV) canvas.__match = match;
    const trail = [];
    let colors = resolveColors();
    let view = { w: 0, h: 0, sx: 1, sy: 1 };
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Full-bleed: the pitch fills the window exactly. The mild anisotropy is
      // invisible at these sizes; dots and the ball stay round (px radii).
      view = { w, h, sx: w / PITCH_W, sy: h / PITCH_H };
    };
    resize();
    window.addEventListener('resize', resize);

    // Re-resolve team colours when the theme class flips.
    const observer = new MutationObserver(() => {
      colors = resolveColors();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      updateMatch(match, dt);
      if (match.ball.owner) {
        trail.length = 0;
      } else {
        trail.push({ x: match.ball.pos.x, y: match.ball.pos.y });
        if (trail.length > 10) trail.shift();
      }
      drawMatch(ctx, match, view, colors, trail);
      raf = requestAnimationFrame(frame);
    };

    if (reduced) {
      // A single believable frame: advance the sim a little, draw once.
      for (let i = 0; i < 240; i++) updateMatch(match, 1 / 60);
      drawMatch(ctx, match, view, colors, []);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  );
}

/** Static pitch geometry for app surfaces — no motion behind data. */
export function PitchLines({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <div className="absolute -right-40 -top-40 size-96 rounded-full border border-foreground/4" />
      <div className="absolute -right-24 -top-24 size-64 rounded-full border border-foreground/4" />
    </div>
  );
}
