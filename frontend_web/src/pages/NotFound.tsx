import { Link } from 'react-router-dom';
import { BrandMark } from '../components/layout/BrandMark';
import './pages.css';

export function NotFound() {
  return (
    <div className="notfound-page">
      <BrandMark size={64} />
      <h1 className="h-title">Page not found</h1>
      <p className="p-body">The page you're looking for doesn't exist.</p>
      <Link to="/home" style={{ color: 'var(--signal)', fontWeight: 600 }}>
        Back to Home
      </Link>
    </div>
  );
}
