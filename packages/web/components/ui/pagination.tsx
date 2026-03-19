interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="rounded-lg border border-[#1a1a1a] bg-white/[0.02] px-3 py-1.5 transition-colors hover:bg-white/[0.06] hover:text-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="rounded-lg border border-[#1a1a1a] bg-white/[0.02] px-3 py-1.5 transition-colors hover:bg-white/[0.06] hover:text-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
