import logo from '../../assets/logo.png';

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <div
      className="brand-ring"
      style={{ width: size, height: size, borderRadius: size / 2 }}>
      <img src={logo} alt="Argus" style={{ width: size, height: size }} />
    </div>
  );
}

export function BrandLockup({ compact }: { compact?: boolean }) {
  return (
    <div className="brand-lockup">
      <BrandMark size={compact ? 56 : 92} />
      <span className="brand-name" style={compact ? { fontSize: 20, marginTop: 8 } : undefined}>
        Argus
      </span>
    </div>
  );
}
