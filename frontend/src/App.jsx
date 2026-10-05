import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
const Dev = lazy(() => import("./pages/Dev"));
const CourierAssignmentLab = lazy(() => import("./pages/dev/CourierAssignmentLab"));
import ProtectedRoute from "./components/ProtectedRoute";
import PasswordSecurityNotice from "./components/PasswordSecurityNotice";
import MobileBackToTop from "./components/MobileBackToTop";
import FaqBot from "./components/FaqBot";

import CustomerLayout from "./layouts/CustomerLayout";
import AccountLayout from "./layouts/AccountLayout";
import CustomerHome from "./pages/customer/Home";
import Products from "./pages/customer/Products";
const CustomerNotifications = lazy(() => import("./pages/customer/Notifications"));
const Cart = lazy(() => import("./pages/customer/Cart"));
import Login from "./pages/auth/Login";
const Register = lazy(() => import("./pages/auth/Register"));
import Unauthorized from "./pages/auth/Unauthorized";
import Profile from "./pages/auth/Profile";
const AccountSettings = lazy(() => import("./pages/auth/AccountSettings"));
const Addresses = lazy(() => import("./pages/auth/Addresses"));
import ProductDetail from "./pages/customer/ProductDetail";
const Checkout = lazy(() => import("./pages/customer/Checkout"));
const StorePage = lazy(() => import("./pages/customer/StorePage"));
const CustomerOrders = lazy(() => import("./pages/customer/Orders"));
const CustomerOrderDetail = lazy(() => import("./pages/customer/OrderDetail"));
const MyReviews = lazy(() => import("./pages/customer/MyReviews"));

const MerchantLayout = lazy(() => import("./layouts/MerchantLayout"));
const MerchantDashboard = lazy(() => import("./pages/merchant/Dashboard"));
const Stores = lazy(() => import("./pages/merchant/Stores"));
const StoreDetail = lazy(() => import("./pages/merchant/StoreDetail"));
const ProductManagement = lazy(() => import("./pages/merchant/ProductManagement"));
const AddProduct = lazy(() => import("./pages/merchant/AddProduct"));
const Orders = lazy(() => import("./pages/merchant/Orders"));
const Reviews = lazy(() => import("./pages/merchant/Reviews"));
const EditProduct = lazy(() => import("./pages/merchant/EditProduct"));
const StockManagement = lazy(() => import("./pages/merchant/StockManagement"));
const OrderManagement = lazy(() => import("./pages/merchant/OrderManagement"));
const OrderDetail = lazy(() => import("./pages/merchant/OrderDetail"));
const MerchantApply = lazy(() => import("./pages/merchant/MerchantApply"));
const CreateStore = lazy(() => import("./pages/merchant/CreateStore"));
const PickupToday = lazy(() => import("./pages/merchant/PickupToday"));
const StoreFinance = lazy(() => import("./pages/merchant/StoreFinance"));
const MerchantFinance = lazy(() => import("./pages/merchant/Finance"));

const CourierLayout = lazy(() => import("./layouts/CourierLayout"));
const CourierDashboard = lazy(() => import("./pages/courier/Dashboard"));
const ActiveDeliveries = lazy(() => import("./pages/courier/ActiveDeliveries"));
const CourierHistory = lazy(() => import("./pages/courier/History"));
const Availability = lazy(() => import("./pages/courier/Availability"));
const CourierSettings = lazy(() => import("./pages/courier/Settings"));
const DeliveryDetail = lazy(() => import("./pages/courier/DeliveryDetail"));
const Assignments = lazy(() => import("./pages/courier/Assignments"));
const DeliveryBatches = lazy(() => import("./pages/courier/DeliveryBatches"));
const BatchDetail = lazy(() => import("./pages/courier/BatchDetail"));

const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const ChatInbox = lazy(() => import("./pages/chat/ChatInbox"));
const ChatRoom = lazy(() => import("./pages/chat/ChatRoom"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const MerchantApproval = lazy(() => import("./pages/admin/MerchantApproval"));
const Users = lazy(() => import("./pages/admin/Users"));
const Couriers = lazy(() => import("./pages/admin/Couriers"));
const Transactions = lazy(() => import("./pages/admin/Transactions"));
const AdminReviews = lazy(() => import("./pages/admin/Reviews"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const MerchantApprovalDetail = lazy(() => import("./pages/admin/MerchantApprovalDetail"));
const AdminOrderDetail = lazy(() => import("./pages/admin/AdminOrderDetail"));
const CourierDetail = lazy(() => import("./pages/admin/CourierDetail"));
const AdminDeliveryBatches = lazy(() => import("./pages/admin/DeliveryBatches"));
const AdminFinance = lazy(() => import("./pages/admin/Finance"));
const AdminProductMonitoring = lazy(() => import("./pages/admin/ProductMonitoring"));

function App() {
  return (
    <BrowserRouter>
      <PasswordSecurityNotice />
      <MobileBackToTop />
      <FaqBot />
      <Suspense fallback={<div className="page-container" role="status">Memuat halaman...</div>}><Routes>
        {import.meta.env.DEV && <Route path="/dev" element={<Dev />} />}
        {import.meta.env.DEV && <Route path="/dev/courier-assignment" element={<CourierAssignmentLab />} />}
        <Route path="/" element={<CustomerLayout />}>
          <Route index element={<CustomerHome />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:productId" element={<ProductDetail />} />
          <Route path="stores/:storeId" element={<StorePage />} />
          <Route path="notifications" element={<ProtectedRoute allowedRoles={["customer"]}><CustomerNotifications /></ProtectedRoute>} />
          <Route path="cart" element={<ProtectedRoute allowedRoles={["customer"]}><Cart /></ProtectedRoute>} />
          <Route path="checkout" element={<ProtectedRoute allowedRoles={["customer"]}><Checkout /></ProtectedRoute>} />
          <Route path="orders" element={<ProtectedRoute allowedRoles={["customer"]}><CustomerOrders /></ProtectedRoute>} />
          <Route path="orders/:orderId" element={<ProtectedRoute allowedRoles={["customer"]}><CustomerOrderDetail /></ProtectedRoute>} />
          <Route path="my-reviews" element={<ProtectedRoute allowedRoles={["customer"]}><MyReviews /></ProtectedRoute>} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="unauthorized" element={<Unauthorized />} />
        </Route>

        <Route element={<ProtectedRoute><AccountLayout /></ProtectedRoute>}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/addresses" element={<Addresses />} />
          <Route path="/settings" element={<AccountSettings />} />
          <Route path="/merchant/apply" element={<MerchantApply />} />
          <Route path="/messages" element={<ChatInbox />} />
          <Route path="/messages/:conversationId" element={<ChatRoom />} />
        </Route>

        <Route path="/merchant" element={<ProtectedRoute allowedRoles={["merchant"]}><MerchantLayout /></ProtectedRoute>}>
          <Route index element={<MerchantDashboard />} />
          <Route path="stores" element={<Stores />} />
          <Route path="stores/new" element={<CreateStore />} />
          <Route path="stores/:storeId" element={<StoreDetail />} />
          <Route path="stores/:storeId/finance" element={<StoreFinance />} />
          <Route path="stores/:storeId/products" element={<ProductManagement />} />
          <Route path="stores/:storeId/products/add" element={<AddProduct />} />
          <Route path="stores/:storeId/products/:productId/edit" element={<EditProduct />} />
          <Route path="stores/:storeId/stock" element={<StockManagement />} />
          <Route path="stores/:storeId/orders" element={<OrderManagement />} />
          <Route path="stores/:storeId/orders/:orderId" element={<OrderDetail />} />
          <Route path="orders" element={<Orders />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="notifications" element={<Navigate to="/merchant" replace />} />
          <Route path="settings" element={<Navigate to="/settings" replace />} />
          <Route path="finance" element={<MerchantFinance />} />
          <Route path="pickup" element={<PickupToday />} />
          <Route path="stores/add" element={<Navigate to="/merchant/stores/new" replace />} />
        </Route>

        <Route path="/courier" element={<ProtectedRoute allowedRoles={["courier"]}><CourierLayout /></ProtectedRoute>}>
          <Route index element={<CourierDashboard />} />
          <Route path="assignments" element={<Assignments />} />
          <Route path="batches" element={<DeliveryBatches />} />
          <Route path="batches/:batchId" element={<BatchDetail />} />
          <Route path="active-deliveries" element={<ActiveDeliveries />} />
          <Route path="active-deliveries/:deliveryId" element={<DeliveryDetail />} />
          <Route path="history" element={<CourierHistory />} />
          <Route path="notifications" element={<Navigate to="/courier" replace />} />
          <Route path="availability" element={<Availability />} />
          <Route path="settings" element={<CourierSettings />} />
        </Route>

        <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="merchant-approval" element={<MerchantApproval />} />
          <Route path="merchant-approval/:merchantId" element={<MerchantApprovalDetail />} />
          <Route path="merchant-applications" element={<Navigate to="/admin/merchant-approval" replace />} />
          <Route path="users" element={<Users />} />
          <Route path="couriers" element={<Couriers />} />
          <Route path="couriers/:courierId" element={<CourierDetail />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="products" element={<AdminProductMonitoring />} />
          <Route path="delivery-batches" element={<AdminDeliveryBatches />} />
          <Route path="transactions/:transactionId" element={<Navigate to="/admin/transactions" replace />} />
          <Route path="orders/:orderId" element={<AdminOrderDetail />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="finance" element={<AdminFinance />} />
          <Route path="settings/*" element={<AdminSettings />} />
          <Route path="notifications" element={<CustomerNotifications />} />
          <Route path="support-chats" element={<ChatInbox adminMode />} />
          <Route path="support-chats/:conversationId" element={<ChatRoom adminMode />} />
        </Route>
      </Routes></Suspense>
    </BrowserRouter>
  );
}

export default App;
