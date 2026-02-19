export default function GradientText({
  children,
  className = '',
  colors = ['#7c5cfc', '#818cf8', '#c4b5fd'],
  animationSpeed = 3,
}) {
  const gradient = `linear-gradient(90deg, ${colors.join(', ')}, ${colors[0]})`;
  return (
    <span
      className={className}
      style={{
        backgroundImage: gradient,
        backgroundSize: '200% auto',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: `aurora-shift ${animationSpeed}s linear infinite`,
        display: 'inline-block',
      }}
    >
      {children}
    </span>
  );
}
