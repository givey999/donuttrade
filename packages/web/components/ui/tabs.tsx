interface Tab {
  label: string;
  value: string;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
}

export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div className="flex gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`rounded-lg px-3 py-1.5 text-sm capitalize transition-all duration-200 ${
            value === tab.value
              ? 'border border-violet-600/20 bg-violet-600/[0.06] text-violet-600'
              : 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
