/**
 * Tiny trend line. currentColor throughout so the colour comes from the parent's
 * text colour rather than a hardcoded stroke.
 */
function Sparkline({ values, width = 64, height = 20, className }) {
  if (!values || values.length < 2) return null;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const y = (v) => height - ((v - min) / range) * (height - 4) - 2;
  const points = values.map((v, i) => `${i * stepX},${y(v)}`).join(' ');
  const lastX = (values.length - 1) * stepX;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={y(values[values.length - 1])} r="2.5" fill="currentColor" />
    </svg>
  );
}

export { Sparkline };
