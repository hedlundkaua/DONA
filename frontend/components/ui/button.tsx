import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variante = "primario" | "secundario" | "discreto" | "perigo";
type Tamanho = "sm" | "md" | "lg";

const variantes: Record<Variante, string> = {
  primario:
    "bg-plum text-white hover:bg-plum/90 active:bg-plum shadow-sm",
  secundario:
    "border-2 border-plum bg-white text-plum hover:bg-pink-50 active:bg-pink-100",
  discreto:
    "bg-transparent text-navy hover:bg-pink-50 active:bg-pink-100",
  perigo:
    "border border-danger/40 bg-white text-danger hover:bg-danger/5 active:bg-danger/10",
};

const tamanhos: Record<Tamanho, string> = {
  sm: "h-9 px-3 text-xs gap-1.5",
  md: "h-12 px-5 text-sm gap-2",
  lg: "h-13 px-6 text-base gap-2",
};

export function buttonClasses(
  variante: Variante = "primario",
  tamanho: Tamanho = "md",
  extra?: string,
) {
  return cn(
    "inline-flex items-center justify-center rounded-full font-semibold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
    "disabled:pointer-events-none disabled:opacity-50",
    variantes[variante],
    tamanhos[tamanho],
    extra,
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variante?: Variante;
  tamanho?: Tamanho;
};

export function Button({
  variante = "primario",
  tamanho = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variante, tamanho, className)}
      {...props}
    />
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variante?: Variante;
  tamanho?: Tamanho;
  children: ReactNode;
};

export function ButtonLink({
  variante = "primario",
  tamanho = "md",
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variante, tamanho, className)} {...props}>
      {children}
    </Link>
  );
}
