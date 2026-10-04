import { useEffect, useState } from "react";
import { getTransactionAttachment } from "../services/transactionAttachmentStorage";
import { usePreferences } from "../context/PreferencesContext";

function TransactionAttachmentImage({ attachment, alt }) {
  const { language } = usePreferences();
  const fallbackAlt = language === "id" ? "Bukti pengiriman" : "Delivery proof";
  const [source, setSource] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    getTransactionAttachment(attachment.storageKey).then((blob) => {
      if (!active || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(() => {});
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attachment.storageKey]);
  return source ? <a href={source} target="_blank" rel="noreferrer"><img src={source} alt={alt || fallbackAlt} /></a> : <span>{language === "id" ? "Bukti tidak tersedia" : "Proof unavailable"}</span>;
}

export default TransactionAttachmentImage;
