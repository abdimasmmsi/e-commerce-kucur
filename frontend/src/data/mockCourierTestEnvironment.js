import { mockCouriers, saveCouriers } from "./mockCouriers";
import { getOrders, saveOrders } from "./mockOrders";
import { COURIER_ASSIGNMENT_STATE_KEY } from "../services/courierAssignmentService";
import { getOperationalSettings } from "./mockOperationalSettings";

export const COURIER_TEST_ORDER_PREFIX = "DEV-ORDER-";

export const courierTestAccounts = [
  { courierId: "CR-001", name: "Agus Setiawan", email: "courier1@kucur.test", password: "123456" },
  { courierId: "CR-002", name: "Rini Wulandari", email: "courier2@kucur.test", password: "123456" },
  { courierId: "CR-003", name: "Dedi Firmansyah", email: "courier3@kucur.test", password: "123456" },
];

const courierNames = Object.fromEntries(
  courierTestAccounts.map((account) => [account.courierId, account.name]),
);

const now = () => new Date().toISOString();

const createTestOrder = ({
  id,
  orderNumber,
  customerName,
  courierId,
  assignmentStatus = "pending",
  rejectedCourierIds = [],
}) => {
  const timestamp = now();
  const { assignmentResponseMinutes } = getOperationalSettings();
  return {
    id,
    orderNumber,
    customerId: `CUS-${id}`,
    customerName,
    storeId: "1",
    merchantUserId: "USR-MERCHANT-001",
    items: [{
      productId: "PRD-001",
      productName: "Paket Test Keripik Kucur",
      quantity: 1,
      price: 50000,
      subtotal: 50000,
    }],
    productTotal: 50000,
    deliveryFee: 15000,
    courierTip: 5000,
    totalAmount: 70000,
    paymentMethod: "COD",
    deliveryAddress: `Alamat customer untuk ${orderNumber}, Kabupaten Malang`,
    status: "courier-assigned",
    courierId,
    courierName: courierNames[courierId],
    courierAssignmentStatus: assignmentStatus,
    assignedAt: timestamp,
    assignmentResponseDeadline: assignmentStatus === "pending"
      ? new Date(Date.now() + assignmentResponseMinutes * 60 * 1000).toISOString()
      : null,
    nextAssignmentRoundAt: null,
    rejectedCourierIds,
    courierAssignmentHistory: [
      ...rejectedCourierIds.map((rejectedCourierId) => ({
        courierId: rejectedCourierId,
        courierName: courierNames[rejectedCourierId],
        action: "rejected",
        reason: "Fixture rejection sebelumnya",
        timestamp,
      })),
      {
        courierId,
        courierName: courierNames[courierId],
        action: rejectedCourierIds.length ? "reassigned" : "assigned",
        reason: null,
        timestamp,
      },
      ...(assignmentStatus === "accepted" ? [{
        courierId,
        courierName: courierNames[courierId],
        action: "accepted",
        reason: null,
        timestamp,
      }] : []),
    ],
    statusHistory: [
      { status: "ready-for-pickup", actorType: "merchant", actorName: "Merchant Test", timestamp },
      { status: "courier-assigned", actorType: "system", actorName: "Assignment System", timestamp },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const courierTestScenarios = [
  {
    id: "out-of-office",
    title: "Out of Office tanpa Release",
    orderId: "DEV-ORDER-OOO",
    orderNumber: "DEV-KUC-OOO-001",
    courierId: "CR-001",
    customerName: "Customer Test OOO",
    assignmentStatus: "pending",
    rejectedCourierIds: [],
    description: "Ubah Courier 1 menjadi Out of Office. Order harus tetap dimiliki Courier 1 dan rejection list tetap kosong.",
    expected: "Kembali Available → Courier 1 tetap boleh menerima order ini karena tidak pernah Reject/Release.",
    destination: "/courier/availability",
  },
  {
    id: "release",
    title: "Release assignment accepted",
    orderId: "DEV-ORDER-RELEASE",
    orderNumber: "DEV-KUC-REL-001",
    courierId: "CR-001",
    customerName: "Customer Test Release",
    assignmentStatus: "accepted",
    rejectedCourierIds: [],
    description: "Courier 1 sudah menerima order lalu memilih Lepaskan Assignment dengan alasan wajib.",
    expected: "Courier 1 masuk rejectedCourierIds dan order berpindah ke Courier 2.",
    destination: "/courier/assignments",
  },
  {
    id: "reject-next",
    title: "Reject menuju courier berikutnya",
    orderId: "DEV-ORDER-REJECT",
    orderNumber: "DEV-KUC-REJ-001",
    courierId: "CR-002",
    customerName: "Customer Test Reject",
    assignmentStatus: "pending",
    rejectedCourierIds: ["CR-001"],
    description: "Courier 1 sudah menolak dan Courier 2 memegang pending assignment.",
    expected: "Courier 2 Reject → Courier 3 assigned; Courier 1 dan 2 tetap excluded.",
    destination: "/courier/assignments",
  },
  {
    id: "waiting",
    title: "Tidak ada courier eligible",
    orderId: "DEV-ORDER-WAITING",
    orderNumber: "DEV-KUC-WAIT-001",
    courierId: "CR-003",
    customerName: "Customer Test Waiting",
    assignmentStatus: "pending",
    rejectedCourierIds: ["CR-001", "CR-002"],
    description: "Courier 1 dan 2 sudah menolak; Courier 3 menjadi kandidat terakhir.",
    expected: "Courier 3 Reject → status Waiting for Courier dan ketiganya tidak masuk lagi ke siklus order.",
    destination: "/courier/assignments",
  },
];

const buildTestOrders = () => courierTestScenarios.map((scenario) => createTestOrder({
  ...scenario,
  id: scenario.orderId,
}));

const isCourierTestOrder = (order) => String(order.id).startsWith(COURIER_TEST_ORDER_PREFIX)
  || String(order.orderNumber).startsWith("DEV-KUC-");

export function seedCourierTestEnvironment(activeScenarioId = "out-of-office") {
  const scenario = courierTestScenarios.find((item) => item.id === activeScenarioId)
    ?? courierTestScenarios[0];
  const regularOrders = getOrders().filter((order) => !isCourierTestOrder(order));

  saveCouriers(mockCouriers.map((courier) => ({
    ...courier,
    availability: "available",
    activeDeliveries: courier.id === "CR-001" ? 1 : 0,
    lastAssignedAt: null,
    outOfOfficeReason: "",
    outOfOfficeStart: "",
    outOfOfficeEnd: "",
  })));
  saveOrders([...regularOrders, ...buildTestOrders()]);
  localStorage.setItem(COURIER_ASSIGNMENT_STATE_KEY, JSON.stringify({
    lastAssignedCourierId: scenario.courierId,
  }));

  return { scenario, orders: buildTestOrders() };
}

export function removeCourierTestEnvironment() {
  const regularOrders = getOrders().filter((order) => !isCourierTestOrder(order));
  saveOrders(regularOrders);
  saveCouriers(mockCouriers);
  localStorage.removeItem(COURIER_ASSIGNMENT_STATE_KEY);
  return regularOrders;
}
