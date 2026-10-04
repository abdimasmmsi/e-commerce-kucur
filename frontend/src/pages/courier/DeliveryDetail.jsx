import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import { usePreferences } from "../../context/PreferencesContext";
import { deliveryApi } from "../../services/deliveryApiService";

export default function DeliveryDetail() {
  const { deliveryId } = useParams();
  const { t } = usePreferences();
  const [state, setState] = useState({ loading: true, batchId: "", error: "" });
  useEffect(() => {
    let active = true;
    deliveryApi.courierBatches().then((batches) => {
      if (!active) return;
      const batch = batches.find((row) => row.orders.some((item) => item.id === deliveryId || item.commerceOrderId === deliveryId || item.commerceOrder?.id === deliveryId));
      setState({ loading: false, batchId: batch?.id || "", error: "" });
    }).catch((error) => { if (active) setState({ loading: false, batchId: "", error: error.message }); });
    return () => { active = false; };
  }, [deliveryId]);
  if (state.loading) return <div className="page-container min-w-0"><LoadingPanel label={t("courierDelivery.loading")} rows={4}/></div>;
  if (state.batchId) return <Navigate replace to={`/courier/batches/${state.batchId}`}/>;
  return <div className="page-container min-w-0"><EmptyState title={t("courierDelivery.empty")} description={state.error || t("courierDelivery.emptyHint")}/></div>;
}
