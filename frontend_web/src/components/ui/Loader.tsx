export function Loader({ label }: { label?: string }) {
  return (
    <div className="loader">
      <div className="loader-ring" />
      {label ? <span className="p-meta">{label}</span> : null}
    </div>
  );
}
