import { ArrowRight } from "@phosphor-icons/react";

interface Props {
  onOpenFullPage: () => void;
}

export function PopupFooter({ onOpenFullPage }: Props) {
  return (
    <div className="border-t border-x-border px-4 py-3">
      <button
        type="button"
        onClick={onOpenFullPage}
        className="flex w-full items-center justify-center gap-1 text-sm font-medium text-x-blue transition-opacity hover:opacity-80"
      >
        Open full bookmarks page
        <ArrowRight className="size-4" />
      </button>
    </div>
  );
}
