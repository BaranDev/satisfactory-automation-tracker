import { useEffect, useState, useCallback, useRef } from "react";
import { useProjectStore } from "@/store/projectStore";
import * as api from "@/lib/api";

const POLL_INTERVAL_MS = parseInt(import.meta.env.VITE_POLL_INTERVAL_MS || "5000", 10);
const STORAGE_KEY = "sap-hide-pull-warning";

interface UseRemoteUpdateCheckerResult {
  hasRemoteUpdate: boolean;
  remoteVersion: number | null;
  checkNow: () => Promise<void>;
  hideWarning: boolean;
  setHideWarning: (value: boolean) => void;
}

export function useRemoteUpdateChecker(): UseRemoteUpdateCheckerResult {
  const project = useProjectStore((s) => s.project);
  const cloudProject = useProjectStore((s) => s.cloudProject);
  const syncStatus = useProjectStore((s) => s.syncStatus);

  const [hasRemoteUpdate, setHasRemoteUpdate] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<number | null>(null);
  const [hideWarning, setHideWarningState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const intervalRef = useRef<number | null>(null);

  const setHideWarning = useCallback((value: boolean) => {
    setHideWarningState(value);
    if (value) {
      localStorage.setItem(STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const checkNow = useCallback(async () => {
    if (!project?.project_id) return;

    try {
      const cloudData = await api.checkCloudVersion(project.project_id);
      if (cloudData && cloudData.version > (cloudProject?.version ?? 0)) {
        setHasRemoteUpdate(true);
        setRemoteVersion(cloudData.version);
      } else {
        setHasRemoteUpdate(false);
        setRemoteVersion(null);
      }
    } catch {
      // Silently ignore errors during polling
    }
  }, [project?.project_id, cloudProject?.version]);

  // Reset when sync status changes to in_sync (user pulled/pushed)
  useEffect(() => {
    if (syncStatus === "in_sync") {
      setHasRemoteUpdate(false);
      setRemoteVersion(null);
    }
  }, [syncStatus]);

  // Polling with Page Visibility API
  useEffect(() => {
    if (!project?.project_id) return;

    const startPolling = () => {
      // Initial check
      checkNow();

      // Set up interval
      intervalRef.current = window.setInterval(checkNow, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    // Start polling if tab is visible
    if (!document.hidden) {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [project?.project_id, checkNow]);

  return {
    hasRemoteUpdate,
    remoteVersion,
    checkNow,
    hideWarning,
    setHideWarning,
  };
}
