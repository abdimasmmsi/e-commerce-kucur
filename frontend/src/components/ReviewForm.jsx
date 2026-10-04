import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { reviewService } from "../services/reviewService";
import { deleteReviewImage, saveReviewImage } from "../services/reviewImageStorage";
import { getTourismBooking } from "../services/tourismService";
import { getLiveInBooking } from "../services/liveInService";
import ReviewPhoto from "./ReviewPhoto";
import "./Reviews.css";
import "./ReviewsCanonical.css";
import "./ReviewUpload.css";

function ReviewForm({ targetType, targetId, transactionId, transactionContext = null, onSave = () => {} }) {
  const inputId = useId();
  const { language } = usePreferences();
  const copy = language === "id" ? {
    edit: "Lihat / Edit Ulasan", title: "Beri Ulasan", rating: "Pilih rating", star: "bintang", experience: "Ceritakan pengalaman Anda", placeholder: "Bagikan pengalaman Anda...", addPhotos: "Tambah foto", optional: "Opsional", upload: "Pilih Foto", uploadHint: "JPG, PNG, atau WebP · maksimal 5 foto.", maximum: "Maksimal 5 foto ulasan.", remove: "Hapus", processing: "Memproses foto...", save: "Simpan Perubahan", submit: "Kirim Ulasan", saved: "Ulasan berhasil disimpan.",
  } : {
    edit: "View / Edit Review", title: "Write a Review", rating: "Choose a rating", star: "stars", experience: "Share your experience", placeholder: "Tell others about your experience...", addPhotos: "Add photos", optional: "Optional", upload: "Choose Photos", uploadHint: "JPG, PNG, or WebP · up to 5 photos.", maximum: "You can add up to 5 review photos.", remove: "Remove", processing: "Processing photos...", save: "Save Changes", submit: "Submit Review", saved: "Your review was saved.",
  };
  const pathBookingId = window.location.pathname.split("/").filter(Boolean).at(-1);
  const tourismBooking = !targetType && window.location.pathname.includes("tourism-bookings/") ? getTourismBooking(pathBookingId) : null;
  const liveInBooking = !targetType && window.location.pathname.includes("live-in-bookings/") ? getLiveInBooking(pathBookingId) : null;
  const effectiveType = targetType ?? (tourismBooking ? "educational-tourism" : liveInBooking ? "live-in" : null);
  const effectiveTargetId = targetId ?? tourismBooking?.tourismId ?? liveInBooking?.liveInId;
  const effectiveTransactionId = transactionId ?? tourismBooking?.id ?? liveInBooking?.id;
  const effectiveContext = transactionContext ?? (tourismBooking ? { title: tourismBooking.tourismName, detail: tourismBooking.scheduleDate } : liveInBooking ? { title: liveInBooking.liveInName, detail: `${liveInBooking.checkIn} – ${liveInBooking.checkOut}` } : null);
  useAuth();
  const existing = null;
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState([]);
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const added = useRef(new Set());
  const removed = useRef(new Set());
  const saved = useRef(false);

  useEffect(() => () => { if (!saved.current) added.current.forEach(deleteReviewImage); }, []);
  const upload = async (event) => {
    const files = [...event.target.files]; event.target.value = "";
    if (photos.length + files.length > 5) return setMessage(copy.maximum);
    setProcessing(true); setMessage("");
    for (const file of files) {
      try {
        const photo = await saveReviewImage(file);
        added.current.add(photo.storageKey);
        setPhotos((current) => [...current, photo]);
      } catch (error) { setMessage(error.message); }
    }
    setProcessing(false);
  };
  const remove = (photo) => {
    if (photo.storageKey) removed.current.add(photo.storageKey);
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
  };
  const submit = async (event) => {
    event.preventDefault(); setProcessing(true); setMessage("");
    try {
      const sourceId = effectiveType === "product" ? effectiveTargetId : effectiveTransactionId;
      const result = await reviewService.create(effectiveType, sourceId, { rating, comment: text, photos, orderId: effectiveTransactionId });
      await Promise.all([...removed.current].filter((key) => !photos.some((photo) => photo.storageKey === key)).map(deleteReviewImage));
      saved.current = true; setMessage(copy.saved); onSave(result);
    } catch (error) { setMessage(error.message); }
    finally { setProcessing(false); }
  };

  return <form className="review-form-component" onSubmit={submit}>
    <div><h3>{existing ? copy.edit : copy.title}</h3>{effectiveContext && <p className="review-transaction-context"><strong>{effectiveContext.title}</strong><span>{effectiveContext.detail}</span></p>}</div>
    <div className="review-star-input" aria-label={copy.rating}>{[1, 2, 3, 4, 5].map((value) => <button type="button" aria-label={`${value} ${copy.star}`} className={value <= rating ? "selected" : ""} onClick={() => { setRating(value); setMessage(""); }} key={value}>★</button>)}</div>
    <label><span>{copy.experience}</span><textarea rows="4" maxLength="1000" value={text} onChange={(event) => setText(event.target.value)} placeholder={copy.placeholder}/><small>{text.length}/1000</small></label>
    <div className="review-upload"><div><strong>{copy.addPhotos}</strong><span>{copy.optional}</span></div><input className="sr-only" id={inputId} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={upload} disabled={processing || photos.length >= 5}/><label className="review-upload-button" htmlFor={inputId}>{processing ? copy.processing : copy.upload}</label><small>{copy.uploadHint}</small></div>
    {photos.length > 0 && <div className="review-form-photos">{photos.map((photo) => <article key={photo.id}><ReviewPhoto photo={photo}/><button className="danger" type="button" onClick={() => remove(photo)}>{copy.remove}</button></article>)}</div>}
    {message && <p role="status">{message}</p>}
    <button className="primary-button" type="submit" disabled={processing}>{processing ? copy.processing : existing ? copy.save : copy.submit}</button>
  </form>;
}

export default ReviewForm;
