import { lazy, Suspense, type ComponentProps } from "react";

type GrainGradientProps = ComponentProps<typeof import("@paper-design/shaders-react").GrainGradient>;

const ClientGrainGradient = import.meta.env.SSR
  ? null
  : lazy(async () => {
      const module = await import("@paper-design/shaders-react");

      return {
        default: module.GrainGradient,
      };
    });

/**
 * Renders the Paper Design grain shader only in the browser.
 */
export function GrainGradient(props: GrainGradientProps) {
  if (!ClientGrainGradient) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <ClientGrainGradient {...props} />
    </Suspense>
  );
}
