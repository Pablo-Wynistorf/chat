export default function Aurora({
  colorStops = ['#3A29FF', '#7c5cfc', '#FF3232'],
  speed = 1,
  blend = 0.5,
  amplitude = 0.4,
  className = '',
}) {
  const gradient = `linear-gradient(135deg, ${colorStops.join(', ')})`;
  const duration = 8 / speed;

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <div
        style={{
          position: 'absolute',
          inset: `-${amplitude * 100}%`,
          background: gradient,
          backgroundSize: '400% 400%',
          animation: `aurora-shift ${duration}s ease infinite`,
          opacity: blend,
          filter: 'blur(60px)',
        }}
      />
    </div>
  );
}
