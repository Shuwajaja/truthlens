/** Short, interruptible presentation motion. Never simulates agent work or evidence. */
export function reveal(
  element: HTMLElement | null,
  kind: "panel" | "content" = "content",
) {
  if (
    !element ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !element.animate
  )
    return;
  const animation = element.animate(
    kind === "panel"
      ? [
          { opacity: 0, transform: "translateX(24px)" },
          { opacity: 1, transform: "translateX(0)" },
        ]
      : [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
    {
      duration: kind === "panel" ? 240 : 180,
      easing: "cubic-bezier(.2,.7,.2,1)",
    },
  );
  return () => animation.cancel();
}
