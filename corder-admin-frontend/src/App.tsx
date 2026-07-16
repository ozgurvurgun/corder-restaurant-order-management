import { Routes, Route, Navigate } from "react-router-dom"
import { usePlatformAuth } from "@/lib/auth-context"
import { LoginPage } from "@/pages/LoginPage"
import { DashboardLayout } from "@/pages/DashboardLayout"
import { DashboardPage } from "@/pages/DashboardPage"
import { RestaurantsPage } from "@/pages/RestaurantsPage"
import { NewRestaurantPage } from "@/pages/NewRestaurantPage"
import { EditRestaurantPage } from "@/pages/EditRestaurantPage"

function HomeRedirect() {
  const { isAuthenticated } = usePlatformAuth()
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="restaurants" element={<RestaurantsPage />} />
        <Route path="restaurants/new" element={<NewRestaurantPage />} />
        <Route path="restaurants/:id" element={<EditRestaurantPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
