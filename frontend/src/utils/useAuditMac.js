import { useEffect } from "react";
import { fetchAndStoreUserMacAddress } from "./userMacAddress";

const useAuditMac = () => {
  useEffect(() => {
    fetchAndStoreUserMacAddress().catch((err) => {
      console.error("Failed to preload MAC address for audit logs:", err);
    });
  }, []);
};

export default useAuditMac;
