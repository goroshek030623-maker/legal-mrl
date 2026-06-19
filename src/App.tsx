import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'
import HomePage from './pages/HomePage'
import CasesPage from './pages/CasesPage'
import CaseDetailPage from './pages/CaseDetailPage'
import NewCasePage from './pages/NewCasePage'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'

function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
          <Route path="/cases" element={<PrivateRoute><CasesPage /></PrivateRoute>} />
          <Route path="/cases/new" element={<PrivateRoute><NewCasePage /></PrivateRoute>} />
          <Route path="/cases/:id" element={<PrivateRoute><CaseDetailPage /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
        </Routes>
      </Layout>
    </AuthProvider>
  )
}

export default App
