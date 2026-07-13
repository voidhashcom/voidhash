import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { SvgGradientScene } from "@/features/www/shader-preview/svg-gradient-scene";

const shaderPreviewSearchSchema = z.object({
  angle: z.coerce.number().min(0).max(180).optional().catch(undefined),
  period: z.coerce.number().min(0.01).max(0.2).optional().catch(undefined),
  strength: z.coerce.number().min(-100).max(100).optional().catch(undefined),
  x: z.coerce.number().min(0).max(1).optional().catch(undefined),
  y: z.coerce.number().min(0).max(1).optional().catch(undefined),
});

export const Route = createFileRoute("/shader-preview")({
  component: ShaderPreviewPage,
  head: () => ({
    meta: [{ title: "Voidhash Shader Preview" }],
  }),
  validateSearch: zodValidator(shaderPreviewSearchSchema),
});

function ShaderPreviewPage() {
  const search = Route.useSearch();

  return (
    <main className="min-h-dvh bg-black">
      <SvgGradientScene
        settings={{
          angleDegrees: search.angle,
          centerX: search.x,
          centerY: search.y,
          periodRatio: search.period,
          strength: search.strength,
        }}
      />
    </main>
  );
}
