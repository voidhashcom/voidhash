import { Footer } from '@/components/hero/footer';
import { Hero } from '@/components/hero/hero';

export default function Home() {
  return (
    <div className="min-w-screen md:min-h-screen">
      <main className="flex w-full max-w-7xl flex-col md:mx-auto">
        <Hero />
      </main>
      <Footer />
    </div>
  );
}
