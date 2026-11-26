import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-[shimmer_1.8s_linear_infinite] rounded-md bg-[linear-gradient(100deg,var(--studio-raised)_20%,color-mix(in_srgb,var(--studio-subtle)_22%,var(--studio-raised))_50%,var(--studio-raised)_80%)] bg-[length:220%_100%] motion-reduce:animate-pulse", className)}
      {...props}
    />
  )
}

export { Skeleton }
