import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { CustomerOrderPage } from './pages/CustomerOrderPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminOrdersPage } from './pages/AdminOrdersPage';
import { AdminOrderBoardPage } from './pages/AdminOrderBoardPage';
import { useAuth } from './context/AuthContext';

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Checking account...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/admin" replace />;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            {/* Public Customer Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/order/:code" element={<CustomerOrderPage />} />

            {/* Secret Admin Routes */}
            <Route path="/admin" element={<AdminLoginPage />} />
            <Route
              path="/admin/orders"
              element={
                <ProtectedAdminRoute>
                  <AdminOrdersPage />
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/order/:code"
              element={
                <ProtectedAdminRoute>
                  <AdminOrderBoardPage />
                </ProtectedAdminRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
