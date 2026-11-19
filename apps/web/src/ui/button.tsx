import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const buttonVariants = cva(
  "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors select-none disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft/80",
        outline: "border border-input bg-surface text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        danger: "bg-danger text-primary-foreground hover:bg-danger/90",
      },
      size: {
        md: "",
        /** Компактнее по ширине, но высота та же 44: зона касания не уменьшается. */
        sm: "px-3 text-sm",
        lg: "min-h-12 px-6 text-base",
        icon: "px-0",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

/**
 * Кнопка. Зона касания не меньше 44×44. Для кнопки-иконки (`size="icon"`) обязателен `aria-label`.
 * Ссылку в виде кнопки делай так: `<Link className={buttonVariants({ variant: "outline" })}>`.
 */
export function Button({
  className,
  variant,
  size,
  block,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}
