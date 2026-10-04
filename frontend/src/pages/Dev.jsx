import { Link } from "react-router-dom";

const routeGroups = [
  {
    title: "Customer",
    color: "#2563eb",
    routes: [
      ["Home", "/"],
      ["Product Catalog", "/products"],
      ["Product Detail", "/products/PRD-001"],
      ["Educational Tourism", "/educational-tourism"],
      ["Tourism Detail", "/educational-tourism/TOUR-001"],
      ["Live In Catalog", "/live-in"],
      ["Live In Detail", "/live-in/HOUSE-001"],
      ["Notifications", "/notifications"],
      ["Cart", "/cart"],
      ["Checkout", "/checkout"],
      ["Orders", "/orders"],
      ["Order Detail", "/orders/ORD-001"],
      ["Tourism Bookings", "/tourism-bookings"],
      ["Tourism Booking Detail", "/tourism-bookings/TB-001"],
      ["Live In Bookings", "/live-in-bookings"],
      ["Live In Booking Detail", "/live-in-bookings/LIB-001"],
      ["Login / Register", "/login"],
      ["Register", "/register"],
      ["Unauthorized", "/unauthorized"],
    ],
  },
  {
    title: "Merchant",
    color: "#16a34a",
    routes: [
      ["Dashboard", "/merchant"],
      ["Stores", "/merchant/stores"],
      ["Add Store", "/merchant/stores/add"],
      ["E-Commerce Store Detail", "/merchant/stores/1"],
      ["Product Management", "/merchant/stores/1/products"],
      ["Add Product", "/merchant/stores/1/products/add"],
      ["Edit Product", "/merchant/stores/1/products/1/edit"],
      ["Stock Management", "/merchant/stores/1/stock"],
      ["Order Management", "/merchant/stores/1/orders"],
      ["Order Detail", "/merchant/stores/1/orders/ORD-001"],
      ["Tourism Store Detail", "/merchant/stores/2"],
      ["Tourism Management", "/merchant/stores/2/tourism"],
      ["Add Tourism", "/merchant/stores/2/tourism/add"],
      ["Edit Tourism", "/merchant/stores/2/tourism/TOUR-001/edit"],
      ["Tourism Schedule", "/merchant/stores/2/tourism/TOUR-001/schedule"],
      ["Tourism Bookings", "/merchant/stores/2/tourism/bookings"],
      ["Tourism Booking Detail", "/merchant/stores/2/tourism/bookings/BK-001"],
      ["Live In Store Detail", "/merchant/stores/3"],
      ["Live In Management", "/merchant/stores/3/live-in"],
      ["Add Live In House", "/merchant/stores/3/live-in/add"],
      ["Live In House Detail", "/merchant/stores/3/live-in/HOUSE-001"],
      ["Room Management", "/merchant/stores/3/live-in/HOUSE-001/rooms"],
      ["Add Room", "/merchant/stores/3/live-in/HOUSE-001/rooms/add"],
      ["Edit Room", "/merchant/stores/3/live-in/HOUSE-001/rooms/ROOM-001/edit"],
      ["Room Availability", "/merchant/stores/3/live-in/HOUSE-001/availability"],
      ["Live In Bookings", "/merchant/stores/3/live-in/bookings"],
      ["Live In Booking Detail", "/merchant/stores/3/live-in/bookings/LIB-001"],
      ["General Orders", "/merchant/orders"],
      ["General Bookings", "/merchant/bookings"],
      ["Reviews", "/merchant/reviews"],
      ["Notifications", "/merchant/notifications"],
      ["Settings", "/merchant/settings"],
    ],
  },
  {
    title: "Courier",
    color: "#7c3aed",
    routes: [
      ["Dashboard", "/courier"],
      ["Active Deliveries", "/courier/active-deliveries"],
      ["Delivery Detail", "/courier/active-deliveries/DLV-001"],
      ["Delivery History", "/courier/history"],
      ["Notifications", "/courier/notifications"],
      ["Availability", "/courier/availability"],
      ["Courier Assignment Test Lab", "/dev/courier-assignment"],
      ["Settings", "/courier/settings"],
    ],
  },
  {
    title: "Admin",
    color: "#dc2626",
    routes: [
      ["Monitoring Dashboard", "/admin"],
      ["Merchant Approval", "/admin/merchant-approval"],
      ["Merchant Approval Detail", "/admin/merchant-approval/MRC-001"],
      ["Users", "/admin/users"],
      ["Couriers", "/admin/couriers"],
      ["Courier Detail", "/admin/couriers/CR-001"],
      ["Transactions", "/admin/transactions"],
      ["Transaction Detail", "/admin/transactions/TRX-EC-001"],
      ["Reports", "/admin/reports"],
      ["Review Moderation", "/admin/reviews"],
      ["Analytics", "/admin/analytics"],
      ["Notifications", "/admin/notifications"],
      ["Live Chat CS", "/admin/support-chats"],
      ["Bug Reports", "/admin/bug-reports"],
      ["Settings", "/admin/settings"],
    ],
  },
];

const styles = {
  page: {
    minHeight: "100vh",
    padding: "32px clamp(16px, 4vw, 56px) 56px",
    background: "#f7f7f7",
    color: "#111827",
  },
  container: { width: "min(1400px, 100%)", margin: "0 auto" },
  header: { marginBottom: "28px" },
  title: { margin: "0 0 8px", fontSize: "clamp(1.8rem, 4vw, 2.7rem)" },
  subtitle: { margin: 0, color: "#6b7280", lineHeight: 1.6 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 310px), 1fr))",
    gap: "20px",
  },
  group: {
    padding: "20px",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    background: "white",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.03)",
  },
  groupTitle: { margin: "0 0 16px", fontSize: "1.15rem" },
  list: { display: "grid", gap: "8px" },
  link: {
    display: "grid",
    gap: "3px",
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "9px",
    background: "#fafafa",
    color: "#111827",
  },
  path: { color: "#6b7280", fontSize: "0.72rem", overflowWrap: "anywhere" },
};

function Dev() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Kucur Platform · Dev Routes</h1>
          <p style={styles.subtitle}>
            Indeks cepat seluruh modul. Route parameter menggunakan ID mock yang tersedia.
          </p>
        </header>

        <div style={styles.grid}>
          {routeGroups.map((group) => (
            <section key={group.title} style={{ ...styles.group, borderTop: `4px solid ${group.color}` }}>
              <h2 style={{ ...styles.groupTitle, color: group.color }}>{group.title}</h2>
              <div style={styles.list}>
                {group.routes.map(([label, path]) => (
                  <Link key={`${group.title}-${path}`} to={path} style={styles.link}>
                    <strong>{label}</strong>
                    <span style={styles.path}>{path}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

export default Dev;
