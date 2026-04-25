import { Navigate, Route, Routes } from "react-router-dom";

import AdminLayout from "../layouts/AdminLayout";
import DashboardPage from "../pages/DashboardPage";

function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<DashboardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
