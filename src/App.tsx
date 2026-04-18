import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { RequireAdmin } from './components/RequireAdmin';
import { SignInPage } from './pages/SignIn';
import { UnauthorizedPage } from './pages/Unauthorized';
import { DashboardPage } from './pages/Dashboard';
import { UsersPage } from './pages/Users';
import { UserSessionsPage } from './pages/UserSessions';
import { SessionPage } from './pages/Session';
import { PendingPage } from './pages/Pending';
import { DirectoryPage } from './pages/Directory';
import { DirectoryTablePage } from './pages/DirectoryTable';
import { DirectoryEditPage } from './pages/DirectoryEdit';
import { FunctionCallsPage } from './pages/FunctionCalls';
import { AdminsPage } from './pages/Admins';

function Protected({ element }: { element: React.ReactNode }) {
  return <RequireAdmin>{element}</RequireAdmin>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/" element={<Protected element={<DashboardPage />} />} />
        <Route path="/users" element={<Protected element={<UsersPage />} />} />
        <Route path="/users/:userId" element={<Protected element={<UserSessionsPage />} />} />
        <Route path="/sessions/:sessionId" element={<Protected element={<SessionPage />} />} />
        <Route path="/pending" element={<Protected element={<PendingPage />} />} />
        <Route path="/directory" element={<Protected element={<DirectoryPage />} />} />
        <Route path="/directory/:table" element={<Protected element={<DirectoryTablePage />} />} />
        <Route path="/directory/:table/:id" element={<Protected element={<DirectoryEditPage />} />} />
        <Route path="/function-calls" element={<Protected element={<FunctionCallsPage />} />} />
        <Route path="/admins" element={<Protected element={<AdminsPage />} />} />
      </Routes>
    </BrowserRouter>
  );
}
