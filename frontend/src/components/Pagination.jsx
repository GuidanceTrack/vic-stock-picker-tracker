import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Pagination component with page numbers and navigation buttons
 */
export default function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    disabled = false
}) {
    // Generate page numbers to display with ellipsis
    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 7;

        if (totalPages <= maxVisible) {
            // Show all pages if total is small
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            if (currentPage > 3) {
                pages.push('...');
            }

            // Show pages around current
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) {
                    pages.push(i);
                }
            }

            if (currentPage < totalPages - 2) {
                pages.push('...');
            }

            // Always show last page
            if (!pages.includes(totalPages)) {
                pages.push(totalPages);
            }
        }

        return pages;
    };

    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-1 py-4">
            {/* First page button */}
            <button
                onClick={() => onPageChange(1)}
                disabled={disabled || currentPage === 1}
                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="First page"
            >
                <ChevronsLeft size={18} className="text-slate-600" />
            </button>

            {/* Previous button */}
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={disabled || currentPage === 1}
                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
            >
                <ChevronLeft size={18} className="text-slate-600" />
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1 mx-2">
                {getPageNumbers().map((page, idx) => (
                    page === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">...</span>
                    ) : (
                        <button
                            key={page}
                            onClick={() => onPageChange(page)}
                            disabled={disabled}
                            className={`min-w-[36px] h-9 px-3 rounded-lg font-medium text-sm transition-colors ${
                                page === currentPage
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'hover:bg-slate-100 text-slate-700'
                            }`}
                        >
                            {page}
                        </button>
                    )
                ))}
            </div>

            {/* Next button */}
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={disabled || currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next page"
            >
                <ChevronRight size={18} className="text-slate-600" />
            </button>

            {/* Last page button */}
            <button
                onClick={() => onPageChange(totalPages)}
                disabled={disabled || currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Last page"
            >
                <ChevronsRight size={18} className="text-slate-600" />
            </button>
        </div>
    );
}
