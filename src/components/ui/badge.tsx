import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex min-h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] whitespace-nowrap shadow-[inset_0_1px_rgb(255_255_255_/_0.04)] focus-visible:ring-2 focus-visible:ring-ring has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3.5!",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/15 text-emerald-200",
        secondary: "border-border bg-[var(--studio-raised)] text-secondary-foreground",
        destructive: "border-destructive/40 bg-destructive/15 text-red-200 focus-visible:ring-destructive/20",
        outline: "border-border bg-white/[0.025] text-foreground",
        ghost: "border-transparent bg-transparent text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
