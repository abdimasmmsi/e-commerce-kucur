import { useState } from "react";
import { apiAssetUrl } from "../services/apiClient";
import "./UserAvatar.css";

const initialsFor = (fullName) => {
  const words = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "U";
  return `${words[0][0]}${words.length > 1 ? words.at(-1)[0] : ""}`.toUpperCase();
};

function UserAvatar({ className = "", decorative = true, size = 36, user }) {
  const source = apiAssetUrl(user?.avatarUrl);
  const [failedSource, setFailedSource] = useState("");
  const style = {
    "--user-avatar-size": `${size}px`,
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    flex: `0 0 ${size}px`,
  };
  return <span className={`user-avatar ${className}`.trim()} style={style} aria-hidden={decorative || undefined}>
    {source && failedSource !== source
      ? <img className="user-avatar__image" src={source} alt={decorative ? "" : user?.fullName || ""} onError={() => setFailedSource(source)}/>
      : <span className="user-avatar__initials" aria-label={decorative ? undefined : user?.fullName || undefined}>{initialsFor(user?.fullName)}</span>}
  </span>;
}

export default UserAvatar;
