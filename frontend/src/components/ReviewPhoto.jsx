import { useEffect, useState } from "react";
import { getReviewImage } from "../services/reviewImageStorage";

function ReviewPhoto({ photo, alt = "Foto ulasan", onClick = null }) {
  const [source, setSource] = useState(photo?.url ?? "");
  useEffect(() => { let objectUrl = ""; let active = true; if (photo?.storageKey) getReviewImage(photo.storageKey).then((blob) => { if (!blob || !active) return; objectUrl = URL.createObjectURL(blob); setSource(objectUrl); }); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [photo]);
  if (!source) return <div className="review-photo-loading" role="status" aria-label={alt}/>;
  return <button className="review-photo-button" type="button" onClick={() => onClick?.({ ...photo, source })}><img src={source} alt={alt}/></button>;
}
export default ReviewPhoto;
