import { clsx, ClassValue } from "clsx";
import { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(ts: Timestamp | null | undefined, withTime = false): string {
  if (!ts) return "-";
  const d = ts.toDate();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  if (!withTime) return `${y}.${m}.${day}`;
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${day} ${h}:${min}`;
}

export function toTel(phone?: string) {
  return phone ? `tel:${phone.replace(/[^0-9+]/g, "")}` : undefined;
}

export function toSms(phone?: string) {
  return phone ? `sms:${phone.replace(/[^0-9+]/g, "")}` : undefined;
}

export function toMailto(email?: string) {
  return email ? `mailto:${email}` : undefined;
}

export function toGoogleMaps(address?: string) {
  if (!address) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
