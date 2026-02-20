import { useEffect, useRef, useState, type ReactNode } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { cn } from "../lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  className?: string;
  ariaLabelledBy?: string;
  children: ReactNode | ((closing: boolean) => ReactNode);
}

export function Modal({ open, onClose, className, ariaLabelledBy, children }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setIsClosing(false);
    } else if (visible) {
      setIsClosing(true);
    }
  }, [open]);

  useHotkeys("escape", () => onClose(), {
    enabled: open,
    enableOnFormTags: true,
  }, [onClose]);

  if (!visible) return null;

  return (
    <div
      ref={backdropRef}
      className={cn(
        "fixed inset-0 z-50",
        isClosing ? "animate-overlay-out" : "animate-overlay-in",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      onAnimationEnd={() => {
        if (isClosing) {
          setVisible(false);
          setIsClosing(false);
        }
      }}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      {typeof children === "function" ? children(isClosing) : children}
    </div>
  );
}
