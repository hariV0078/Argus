import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { IoAlertCircle, IoEye, IoEyeOff, IoLogInOutline } from 'react-icons/io5';
import { BrandLockup } from '../components/layout/BrandMark';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { useAuthStore } from '../store/authStore';
import './pages.css';

export function Login() {
  const navigate = useNavigate();
  const loggedIn = useAuthStore((s) => s.loggedIn);
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [email, setEmail] = useState('ashwinram28102005@ntro.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loggedIn) return <Navigate to="/home" replace />;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = login(email, password);
    if (ok) {
      navigate('/home', { replace: true });
      return;
    }
    setBusy(false);
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-hero">
          <BrandLockup />
          <span className="login-tagline">Single-pass drone reconstruction</span>
        </div>

        <Card>
          <form onSubmit={onSubmit}>
            <Field
              label="Email"
              autoCapitalize="none"
              autoCorrect="off"
              type="email"
              value={email}
              onChange={(e) => {
                clearError();
                setEmail(e.target.value);
              }}
            />
            <Field
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="Password"
              value={password}
              onChange={(e) => {
                clearError();
                setPassword(e.target.value);
              }}
              right={
                <button type="button" className="field-icon-btn" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <IoEyeOff size={20} /> : <IoEye size={20} />}
                </button>
              }
            />

            {error ? (
              <div className="err-row">
                <IoAlertCircle size={16} />
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              icon={<IoLogInOutline size={18} />}
              loading={busy}
              disabled={!email || !password}
              style={{ marginTop: 20 }}>
              Sign in
            </Button>
          </form>
        </Card>
        <div className="demo-hint">
          Demo credentials — ashwinram28102005@ntro.com / Ashwin@28102005
        </div>
      </div>
    </div>
  );
}
