import axios from "axios";
import API_BASE_URL from "../apiConfig";

const STORAGE_KEY = "user_mac_address";

export const getStoredUserMacAddress = () =>
  localStorage.getItem(STORAGE_KEY) || "";

export const setStoredUserMacAddress = (macAddress) => {
  const normalized = String(macAddress || "").trim();
  if (!normalized) {
    localStorage.removeItem(STORAGE_KEY);
    return "";
  }
  localStorage.setItem(STORAGE_KEY, normalized);
  return normalized;
};

export const fetchAndStoreUserMacAddress = async () => {
  const cached = getStoredUserMacAddress();
  if (cached) return cached;

  try {
    const { data } = await axios.get(`${API_BASE_URL}/api/user-mac-address`);
    return setStoredUserMacAddress(data?.mac_address);
  } catch (err) {
    console.error("Failed to resolve user MAC address:", err);
    return "";
  }
};

export const getLoginMacPayload = () => {
  const user_mac_address = getStoredUserMacAddress();
  return user_mac_address ? { user_mac_address } : {};
};
