import type { ReactNode, HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';

interface TableProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Table({ children, className = '', ...props }: TableProps) {
  return (
    <div className={`overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0d0d14] ${className}`} {...props}>
      {/* Browser dots bar */}
      <div className="flex items-center gap-2 border-b border-[#1a1a1a] bg-white/[0.02] px-4 py-2.5">
        <div className="h-2 w-2 rounded-full bg-[#ff5f57]" />
        <div className="h-2 w-2 rounded-full bg-[#ffbd2e]" />
        <div className="h-2 w-2 rounded-full bg-[#28c840]" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">{children}</table>
      </div>
    </div>
  );
}

interface TheadProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

export function Thead({ children, className = '', ...props }: TheadProps) {
  return (
    <thead className={`border-b border-[#1a1a1a] text-[10px] uppercase tracking-wider text-neutral-600 ${className}`} {...props}>
      {children}
    </thead>
  );
}

interface TbodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

export function Tbody({ children, className = '', ...props }: TbodyProps) {
  return (
    <tbody className={`divide-y divide-[#1a1a1a]/50 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
}

export function Th({ children, className = '', ...props }: ThProps) {
  return (
    <th className={`px-3 py-2.5 ${className}`} {...props}>
      {children}
    </th>
  );
}

interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
}

export function Td({ children, className = '', ...props }: TdProps) {
  return (
    <td className={`px-3 py-2.5 text-neutral-300 ${className}`} {...props}>
      {children}
    </td>
  );
}
