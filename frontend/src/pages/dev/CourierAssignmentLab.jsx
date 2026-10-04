import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getCouriers } from "../../data/mockCouriers";
import { getOrders } from "../../data/mockOrders";
import {
  COURIER_TEST_ORDER_PREFIX,
  courierTestAccounts,
  courierTestScenarios,
  removeCourierTestEnvironment,
  seedCourierTestEnvironment,
} from "../../data/mockCourierTestEnvironment";
import "./CourierAssignmentLab.css";

function CourierAssignmentLab() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [message, setMessage] = useState("");
  const [testOrders, setTestOrders] = useState(
    () => getOrders().filter((order) => String(order.id).startsWith(COURIER_TEST_ORDER_PREFIX)),
  );
  const [couriers, setCouriers] = useState(getCouriers);

  const refresh = () => {
    setTestOrders(getOrders().filter(
      (order) => String(order.id).startsWith(COURIER_TEST_ORDER_PREFIX),
    ));
    setCouriers(getCouriers());
  };

  const prepareScenario = (scenario) => {
    seedCourierTestEnvironment(scenario.id);
    refresh();
    setMessage(`${scenario.orderNumber} siap diuji. Data order non-DEV tetap dipertahankan.`);
  };

  const loginAsCourier = async (scenario) => {
    const account = courierTestAccounts.find((item) => item.courierId === scenario.courierId);
    const result = await login(account.email, account.password, "courier");
    if (!result.success) {
      setMessage(result.message);
      return;
    }
    navigate(scenario.destination);
  };

  const removeFixtures = () => {
    removeCourierTestEnvironment();
    refresh();
    setMessage("Semua order DEV dihapus dan data courier dikembalikan ke mock awal.");
  };

  return (
    <main className="courier-test-lab">
      <div className="courier-test-lab__container">
        <header className="courier-test-lab__header">
          <div>
            <span>Development Environment</span>
            <h1>Courier Assignment Test Lab</h1>
            <p>Fixture lokal untuk menguji availability, release, rejection, round-robin, dan Waiting for Courier.</p>
          </div>
          <Link to="/dev">Kembali ke Dev Routes</Link>
        </header>

        <section className="courier-test-lab__notice">
          <strong>Aman untuk data order normal</strong>
          <p>Reset hanya mengganti order dengan prefix DEV-ORDER dan data tiga courier development. Order merchant lainnya tidak dihapus.</p>
        </section>

        {message && <p className="courier-test-lab__message" role="status">{message}</p>}

        <section className="courier-test-lab__accounts">
          <div className="courier-test-lab__section-heading">
            <div><h2>Akun test</h2><p>Password seluruh akun: <strong>123456</strong></p></div>
            <button type="button" onClick={removeFixtures}>Hapus Fixture DEV</button>
          </div>
          <div className="courier-test-lab__account-grid">
            {courierTestAccounts.map((account) => {
              const courier = couriers.find((item) => item.id === account.courierId);
              return (
                <article key={account.courierId}>
                  <strong>{account.name}</strong>
                  <code>{account.email}</code>
                  <span>{courier?.availability ?? "not seeded"} · {courier?.activeDeliveries ?? 0}/{courier?.maxActiveDeliveries ?? 0} active</span>
                </article>
              );
            })}
          </div>
        </section>

        <section className="courier-test-lab__scenarios">
          <div className="courier-test-lab__section-heading">
            <div><h2>Skenario order</h2><p>Klik Siapkan sebelum menjalankan setiap skenario agar pointer round-robin deterministik.</p></div>
          </div>
          <div className="courier-test-lab__scenario-grid">
            {courierTestScenarios.map((scenario) => {
              const order = testOrders.find((item) => item.id === scenario.orderId);
              const account = courierTestAccounts.find((item) => item.courierId === scenario.courierId);
              return (
                <article className="courier-test-lab__scenario" key={scenario.id}>
                  <div className="courier-test-lab__scenario-heading">
                    <div><span>{scenario.orderNumber}</span><h3>{scenario.title}</h3></div>
                    <strong className={order ? "is-ready" : ""}>{order ? "Ready" : "Not seeded"}</strong>
                  </div>
                  <p>{scenario.description}</p>
                  <dl>
                    <div><dt>Login</dt><dd>{account.email}</dd></div>
                    <div><dt>Current courier</dt><dd>{scenario.courierId}</dd></div>
                    <div><dt>Assignment</dt><dd>{order?.courierAssignmentStatus ?? scenario.assignmentStatus}</dd></div>
                    <div><dt>Rejected IDs</dt><dd>{order?.rejectedCourierIds?.join(", ") || "-"}</dd></div>
                  </dl>
                  <div className="courier-test-lab__expected"><strong>Expected</strong><span>{scenario.expected}</span></div>
                  <div className="courier-test-lab__actions">
                    <button type="button" onClick={() => prepareScenario(scenario)}>Siapkan Skenario</button>
                    <button className="is-secondary" type="button" onClick={() => loginAsCourier(scenario)}>Login &amp; Buka Modul</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

export default CourierAssignmentLab;
