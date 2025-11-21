import type { useRouter } from 'next/navigation';

export function nextRenderRedirect(
  router: ReturnType<typeof useRouter>,
  path: string
) {
  setTimeout(() => {
    router.push(path);
  }, 1);
}
