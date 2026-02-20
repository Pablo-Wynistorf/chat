import { useState } from 'react';
import { login, register, confirmRegistration, loginWithOidc } from '../lib/auth';
import GradientText from './reactbits/GradientText';

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login'); // login | register | confirm
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const glassStyle = {
    background: 'rgba(16, 16, 20, 0.65)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const result = await login(email, password);
        if (result.isSignedIn) onAuth();
        else if (result.nextStep?.signInStep === 'CONFIRM_SIGN_UP') setMode('confirm');
      } else if (mode === 'register') {
        const result = await register(email, password);
        if (result.nextStep?.signUpStep === 'CONFIRM_SIGN_UP') setMode('confirm');
        else onAuth();
      } else if (mode === 'confirm') {
        await confirmRegistration(email, code);
        await login(email, password);
        onAuth();
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
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
            {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Verify Email'}
          </GradientText>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode !== 'confirm' ? (
            <>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none text-zinc-200 placeholder:text-zinc-600 focus:ring-1 focus:ring-purple-500/50"
                style={inputStyle}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                minLength={8}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none text-zinc-200 placeholder:text-zinc-600 focus:ring-1 focus:ring-purple-500/50"
                style={inputStyle}
              />
            </>
          ) : (
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Verification code"
              required
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none text-zinc-200 placeholder:text-zinc-600 focus:ring-1 focus:ring-purple-500/50"
              style={inputStyle}
            />
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition cursor-pointer disabled:opacity-50"
            style={{ background: 'rgba(124,92,252,0.8)', border: '1px solid rgba(124,92,252,0.4)' }}
          >
            {loading ? '...' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Sign Up' : 'Verify'}
          </button>
        </form>

        {mode !== 'confirm' && (
          <div className="mt-3">
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">or</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>
            <button
              onClick={() => loginWithOidc()}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white transition cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              Sign in with OneIdp
            </button>
          </div>
        )}

        <div className="mt-4 text-center">
          {mode === 'login' && (
            <button onClick={() => setMode('register')} className="text-xs text-zinc-500 hover:text-zinc-300 transition cursor-pointer">
              Don't have an account? Sign up
            </button>
          )}
          {mode === 'register' && (
            <button onClick={() => setMode('login')} className="text-xs text-zinc-500 hover:text-zinc-300 transition cursor-pointer">
              Already have an account? Sign in
            </button>
          )}
          {mode === 'confirm' && (
            <button onClick={() => setMode('login')} className="text-xs text-zinc-500 hover:text-zinc-300 transition cursor-pointer">
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
