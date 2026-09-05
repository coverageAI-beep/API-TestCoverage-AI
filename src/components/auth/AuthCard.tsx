import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ShieldCheck, Mail, Lock, Sparkles, ArrowRight } from 'lucide-react';

export function AuthCard() {
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithMicrosoft,
    signInAsDemo,
    isDemoMode,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);

  // Email regex allowing any valid email address without domain restriction
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validate = (): boolean => {
    let isValid = true;
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setEmailError('Email address is required');
      isValid = false;
    } else if (!emailRegex.test(cleanEmail)) {
      setEmailError('Please enter a valid email format (e.g. user@domain.com)');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      isValid = false;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (err: unknown) {
      console.error('Auth error:', err);
      const code = (err as { code?: string })?.code || '';
      const message = (err as { message?: string })?.message || 'Authentication failed';

      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPasswordError('Invalid email or password combination');
      } else if (code === 'auth/user-not-found') {
        setEmailError('No account found with this email');
      } else if (code === 'auth/email-already-in-use') {
        setEmailError('An account with this email already exists');
      } else {
        setGeneralError(message.replace('Firebase: ', ''));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicrosoftAuth = async () => {
    setIsMicrosoftLoading(true);
    setGeneralError(null);
    try {
      await signInWithMicrosoft();
    } catch (err: unknown) {
      console.error('Microsoft OAuth error:', err);
      const message = (err as { message?: string })?.message || 'Microsoft Sign-in failed';
      setGeneralError(message.replace('Firebase: ', ''));
    } finally {
      setIsMicrosoftLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAFAFA] flex flex-col justify-center items-center p-4 selection:bg-indigo-100 selection:text-indigo-900">
      <div className="w-full max-w-[400px] flex flex-col items-center">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs mb-3">
            C
          </div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">
            CoverageAI
          </h1>
          <p className="mt-1 text-xs text-stone-500 max-w-xs leading-relaxed">
            Enterprise QA platform for managing API specifications, contracts, and test suites.
          </p>
        </div>

        {/* Auth Card Container */}
        <div className="w-full bg-white rounded-lg border border-stone-200 p-7 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-0.5 bg-stone-200 rounded-md mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setEmailError(null);
                setPasswordError(null);
                setGeneralError(null);
              }}
              className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white text-stone-900 font-semibold shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setEmailError(null);
                setPasswordError(null);
                setGeneralError(null);
              }}
              className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-stone-900 font-semibold shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Microsoft OAuth Sign-in Button */}
          <button
            type="button"
            onClick={handleMicrosoftAuth}
            disabled={isMicrosoftLoading || isLoading}
            className="w-full h-9 px-3.5 py-2 text-xs font-medium bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 hover:border-stone-400 active:bg-stone-100 rounded-md transition-colors shadow-2xs flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
          >
            {/* Standard Microsoft 4-color square logo */}
            <svg
              className="w-4 h-4 shrink-0"
              viewBox="0 0 21 21"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            <span>
              {isMicrosoftLoading
                ? 'Connecting to Microsoft...'
                : 'Sign in with Microsoft'}
            </span>
          </button>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white px-2 text-stone-400 font-mono tracking-wider">
                Or with email
              </span>
            </div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <Input
              label="Work Email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              error={emailError || undefined}
              leftElement={<Mail className="w-4 h-4" />}
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              error={passwordError || undefined}
              leftElement={<Lock className="w-4 h-4" />}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />

            {mode === 'signup' && (
              <Input
                label="Confirm Password"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                leftElement={<Lock className="w-4 h-4" />}
                autoComplete="new-password"
              />
            )}

            {generalError && (
              <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
                {generalError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full mt-1.5"
            >
              {mode === 'signin' ? 'Sign In to Workspace' : 'Create QA Account'}
            </Button>
          </form>

          {/* Local sandbox quick bypass for reviewers */}
          {isDemoMode && (
            <div className="mt-5 pt-4 border-t border-stone-100 flex flex-col gap-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-stone-500 font-medium">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Running in Local Demo Mode</span>
              </div>
              <button
                type="button"
                onClick={() => signInAsDemo('sarah.chen@enterprise.qa')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center justify-center gap-1 transition-colors py-1 cursor-pointer"
              >
                <span>Quick Demo Sign-In as Sarah Chen (Principal QA)</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Security / Compliance micro-copy */}
        <p className="mt-6 text-[11px] text-stone-400 text-center font-mono">
          CoverageAI v0.1.0-alpha • Per-user data isolation
        </p>
      </div>
    </div>
  );
}
