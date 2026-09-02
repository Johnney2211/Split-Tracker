import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { brandEyebrow, btnPrimary, btnSecondary } from '../ui/styles';

export function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <p className={brandEyebrow}>Housemate Split</p>
      <h1 className="mb-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
        Split expenses with your roommates
      </h1>
      <p className="mb-8 max-w-md text-base text-slate-600">
        Track shared bills, settle balances, and keep household money fair.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {isAuthenticated ? (
          <Link to="/dashboard" className={btnPrimary}>
            Go to dashboard
          </Link>
        ) : (
          <>
            <Link to="/register" className={btnPrimary}>
              Get started
            </Link>
            <Link to="/login" className={btnSecondary}>
              Sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
