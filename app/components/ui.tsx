import type { ReactNode } from "react";

interface GradientProps {
  gradient: string;
}

interface NavButtonProps extends GradientProps {
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export function NavButton({ icon, label, isActive, onClick, gradient }: NavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-16 w-16 flex-col items-center justify-center rounded-2xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
        isActive ? `-translate-y-2 bg-gradient-to-r ${gradient} text-white shadow-lg` : "text-gray-500 hover:bg-gray-100"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="mb-1 text-2xl" aria-hidden="true">{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

interface StatBoxProps {
  title: string;
  value: ReactNode;
  icon: string;
  onClick?: () => void;
}

export function StatBox({ title, value, icon, onClick }: StatBoxProps) {
  const content = (
    <>
      <div className="mb-2 text-3xl" aria-hidden="true">{icon}</div>
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase opacity-50">{title}</div>
    </>
  );
  const className = "flex flex-col items-center justify-center rounded-3xl bg-white p-4 text-center text-gray-900 shadow-sm";
  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500`}>
      {content}
    </button>
  ) : <div className={className}>{content}</div>;
}

interface AchievementProps {
  name: string;
  done: boolean;
  subtitle?: string;
}

export function Achievement({ name, done, subtitle }: AchievementProps) {
  return (
    <li className={`flex items-center rounded-2xl p-3 ${done ? "bg-green-50" : "grayscale opacity-40"}`}>
      <div className={`mr-4 flex h-12 w-12 items-center justify-center rounded-full text-xl ${done ? "bg-green-200" : "bg-gray-200"}`}>
        {done ? "🏆" : "🔒"}
      </div>
      <div>
        <div className="font-bold">{name}</div>
        {subtitle && <div className="text-xs opacity-70">{subtitle}</div>}
      </div>
    </li>
  );
}
