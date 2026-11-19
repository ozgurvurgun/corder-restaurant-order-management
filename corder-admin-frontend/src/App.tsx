import { Routes, Route, Navigate } from "react-router-dom"
import { usePlatformAuth } from "@/lib/auth-context"
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog"
import { LoginPage } from "@/pages/LoginPage"
import { DashboardLayout } from "@/pages/DashboardLayout"
import { DashboardPage } from "@/pages/DashboardPage"
import { RestaurantsPage } from "@/pages/RestaurantsPage"
import { NewRestaurantPage } from "@/pages/NewRestaurantPage"
import { EditRestaurantPage } from "@/pages/EditRestaurantPage"
import { BossesPage } from "@/pages/BossesPage"
import { BillingPage } from "@/pages/BillingPage"

function HomeRedirect() {
  const { isAuthenticated } = usePlatformAuth()
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
}

export default function App() {
  return (
    <ConfirmDialogProvider>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="bosses" element={<BossesPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="restaurants" element={<RestaurantsPage />} />
          <Route path="restaurants/new" element={<NewRestaurantPage />} />
          <Route path="restaurants/:id" element={<EditRestaurantPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfirmDialogProvider>
  )
}
