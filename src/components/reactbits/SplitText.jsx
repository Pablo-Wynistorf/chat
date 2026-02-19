import { useSprings, animated } from '@react-spring/web';
import { useEffect, useRef, useState } from 'react';

export default function SplitText({
  text = '',
  className = '',
  delay = 100,
  animationFrom = { opacity: 0, transform: 'translate3d(0,40px,0)' },
  animationTo = { opacity: 1, transform: 'translate3d(0,0,0)' },
  threshold = 0.1,
  rootMargin = '-100px',
  onLetterAnimationComplete,
}) {
  const words = text.split(' ');
  const letters = words.flatMap((word, wi) => {
    const chars = word.split('').map((char) => ({ char, wordIndex: wi }));
    if (wi < words.length - 1) chars.push({ char: '\u00A0', wordIndex: wi });
    return chars;
  });

  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold, rootMargin }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold, rootMargin]);

  const springs = useSprings(
    letters.length,
    letters.map((_, i) => ({
      from: animationFrom,
      to: inView ? animationTo : animationFrom,
      delay: i * delay,
      onRest: i === letters.length - 1 ? onLetterAnimationComplete : undefined,
    }))
  );

  return (
    <span ref={ref} className={className} style={{ display: 'inline-flex', flexWrap: 'wrap' }}>
      {springs.map((style, i) => (
        <animated.span key={i} style={style}>
          {letters[i].char}
        </animated.span>
      ))}
    </span>
  );
}
