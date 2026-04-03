import { useState } from "react";
import { getGroupPersonData } from "@/lib/utils";

interface Props {
  groupName: string;
  size?: number; // px, default 24
  className?: string;
  showTooltip?: boolean;
}

export function GroupPersonAvatar({ groupName, size = 24, className = "", showTooltip = true }: Props) {
  const [imgError, setImgError] = useState(false);
  const data = getGroupPersonData(groupName);
  if (!data) return null;

  return (
    <span
      title={showTooltip ? data.personName : undefined}
      className={`inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden border border-white/20 shadow-sm ${className}`}
      style={{ width: size, height: size, minWidth: size }}
    >
      {!imgError ? (
        <img
          src={data.url}
          alt={data.personName}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className="w-full h-full flex items-center justify-center text-white font-bold"
          style={{ background: data.color, fontSize: size * 0.35 }}
        >
          {data.initials}
        </span>
      )}
    </span>
  );
}
