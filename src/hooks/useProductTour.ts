import { useEffect, useRef } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_KEY = "xbt_tour_completed";

interface Props {
  enabled: boolean;
  hasBookmarks: boolean;
}

export function useProductTour({ enabled, hasBookmarks }: Props) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !hasBookmarks || startedRef.current) return;
    if (localStorage.getItem(TOUR_KEY) === "1") return;

    startedRef.current = true;

    const steps: DriveStep[] = [
      {
        element: '[data-tour="bookmark-card"]',
        popover: {
          title: "Your bookmarks",
          description:
            "Click or press <kbd>O</kbd> to open this bookmark. Once inside, use <kbd>←</kbd> <kbd>→</kbd> to navigate between posts and <kbd>Esc</kbd> to come back",
        },
      },
      {
        element: '[data-tour="open-all-btn"]',
        popover: {
          title: "All bookmarks",
          description: "Press <kbd>L</kbd> to see all your saved bookmarks",
        },
      },
      {
        element: '[data-tour="surprise-btn"]',
        popover: {
          title: "Surprise me",
          description: "Press <kbd>S</kbd> to open a random bookmark",
        },
      },
      {
        element: '[data-tour="settings-btn"]',
        popover: {
          title: "Settings",
          description: "Customize your theme, search bar, and quick links",
        },
      },
    ];

    const timeout = window.setTimeout(() => {
      const tour = driver({
        popoverClass: "xbt-tour-popover",
        stagePadding: 6,
        stageRadius: 12,
        animate: true,
        allowClose: true,
        overlayColor: "rgba(0, 0, 0, 0.6)",
        steps,
        onDestroyed: () => {
          localStorage.setItem(TOUR_KEY, "1");
        },
      });

      tour.drive();
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [enabled, hasBookmarks]);
}
