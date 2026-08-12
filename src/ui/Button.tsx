import type { ReactNode } from "react";

interface ButtonProps {
  type?: "submit" | "button";
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export default function Button({
  type = "button",
  disabled,
  onClick,
  children,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-md bg-stone-100 px-4 py-2.5 font-medium text-stone-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}
