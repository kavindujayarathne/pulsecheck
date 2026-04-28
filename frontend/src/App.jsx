import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ServiceDetail from "./pages/ServiceDetail";
import ServiceForm from "./pages/ServiceForm";
import Incidents from "./pages/Incidents";
import { ROUTES } from "./constants/routes";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<Login />} />
          <Route
            path={ROUTES.DASHBOARD}
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.SERVICE_NEW}
            element={
              <ProtectedRoute>
                <Layout>
                  <ServiceForm />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.SERVICE_EDIT}
            element={
              <ProtectedRoute>
                <Layout>
                  <ServiceForm />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.SERVICE_DETAIL}
            element={
              <ProtectedRoute>
                <Layout>
                  <ServiceDetail />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.INCIDENTS}
            element={
              <ProtectedRoute>
                <Layout>
                  <Incidents />
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
