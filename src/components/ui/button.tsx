import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "studio-button group/button inline-flex shrink-0 items-center justify-center rounded-[14px] border border-transparent text-[14px] font-semibold whitespace-nowrap transition-[transform,background-color,border-color,color] duration-150 ease-out outline-none select-none hover:brightness-[1.08] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:scale-[.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        outline: "border-border bg-card text-foreground hover:border-[#46505a] hover:bg-secondary aria-expanded:bg-muted",
        secondary: "bg-secondary text-secondary-foreground",
        ghost: "border-transparent bg-transparent shadow-none hover:bg-muted hover:text-foreground",
        destructive: "border-[#b91c1c] bg-[#b91c1c] text-white hover:bg-[#dc2626]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "min-h-9 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "min-h-10 gap-1.5 px-3 text-[13px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        lg: "min-h-12 gap-2 px-5 text-base has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-11",
        "icon-xs": "size-9 [&_svg:not([class*='size-'])]:size-5",
        "icon-sm": "size-10 [&_svg:not([class*='size-'])]:size-5",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
