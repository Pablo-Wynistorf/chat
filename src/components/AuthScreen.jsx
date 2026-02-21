import { loginWithOidc } from '../lib/auth';
import GradientText from './reactbits/GradientText';

export default function AuthScreen() {
  const glassStyle = {
    background: 'rgba(16, 16, 20, 0.65)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(8,8,10,0.95)' }}>
      <div className="w-[92vw] max-w-sm rounded-2xl shadow-2xl shadow-black/60 p-6" style={glassStyle}>
        <div className="text-center mb-6">
          <GradientText
            className="text-xl font-bold"
            colors={['#7c5cfc', '#00ffd1', '#ff5c7a', '#7c5cfc']}
            animationSpeed={6}
          >
            Welcome
          </GradientText>
          <p className="text-zinc-500 text-sm mt-2">Sign in to continue</p>
        </div>

        <button
          onClick={() => loginWithOidc()}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition cursor-pointer"
          style={{ background: 'rgba(124,92,252,0.8)', border: '1px solid rgba(124,92,252,0.4)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,92,252,1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,92,252,0.8)'}
        >
          Sign in with OneIdp
        </button>
      </div>
    </div>
  );
}
