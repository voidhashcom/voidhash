'use client';
// import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../button';
// import { Button } from '../button';
import { RefractionStripes } from '../refraction-stripes';
import { SectionContainer } from '../section/section-container';

export function Hero() {
  return (
    <SectionContainer className="w-full">
      <section className="flex flex-col items-center justify-center pt-26">
        <div className="flex flex-col items-center justify-center">
          <div className="rounded-full border border-border bg-card px-4 py-1 font-semibold text-muted-foreground text-sm">
            Closed Alpha Preview - Now Available
          </div>
          <h1 className="mt-6 max-w-xl text-balance text-center font-semibold text-5xl leading-tight tracking-tight">
            Add in-app purchases to React Native in seconds.
          </h1>
          <p className="mt-4 max-w-2xl text-balance text-center text-muted-foreground">
            Voidhash is an open-source subscription management platform for
            React Native that allows you to integrate Google Play and App Store
            purchases with single command.
          </p>
          <div className="mt-10 mb-12 flex w-full items-center justify-center gap-4">
            <form
              action="https://formspree.io/f/mpwjvpve"
              aria-label="Join waitlist"
              className="flex w-full max-w-md flex-col items-center gap-2 rounded-xl border bg-card p-1 sm:flex-row"
              method="POST"
            >
              <label className="sr-only" htmlFor="waitlist-email">
                Email address
              </label>
              <input
                aria-label="Email address"
                autoComplete="email"
                className="flex-1 rounded-md bg-background px-4 py-2 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                id="waitlist-email"
                name="email"
                placeholder="Enter your email"
                required
                type="email"
              />

              <Button className="w-full sm:w-auto" type="submit">
                Join Waitlist
              </Button>
            </form>
            {/* <Button>
              <span>Get Started</span>
              <ChevronRight className="size-4 opacity-50" />
            </Button>
            <Button variant="ghost">
              <span>Documentation</span>
              <ChevronRight className="size-4 opacity-50" />
            </Button> */}
          </div>

          {/* Illustration */}
          <div className="relative mt-12 overflow-hidden">
            <RefractionStripes />
            <motion.div
              animate={{ opacity: 1, translateY: 0 }}
              initial={{ opacity: 0, translateY: 100 }}
              transition={{ duration: 3, ease: 'easeInOut', delay: 0.1 }}
            >
              <svg
                className="w-full text-background"
                fill="none"
                viewBox="0 0 1361 353"
                width="1361"
                xmlns="http://www.w3.org/2000/svg"
              >
                <title>Voidhash Hero Illustration</title>

                <g clipPath="url(#clip0_1135_42)">
                  <g filter="url(#filter0_f_1135_42)">
                    <rect
                      fill="url(#paint0_linear_1135_42)"
                      height="916"
                      width="1431"
                      x="-35"
                      y="-540.454"
                    />
                  </g>
                  <g filter="url(#filter1_f_1135_42)">
                    <rect
                      fill="url(#paint2_linear_1135_42)"
                      height="916"
                      transform="matrix(-1 0 0 1 1396 -540.454)"
                      width="1431"
                    />
                  </g>
                </g>
                <g>
                  <rect
                    fill="url(#fade)"
                    height="353"
                    width="1361"
                    x="0"
                    y="0"
                  />
                </g>
                <defs>
                  <filter
                    colorInterpolationFilters="sRGB"
                    filterUnits="userSpaceOnUse"
                    height="995.6"
                    id="filter0_f_1135_42"
                    width="1510.6"
                    x="-74.8"
                    y="-580.254"
                  >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend
                      in="SourceGraphic"
                      in2="BackgroundImageFix"
                      mode="normal"
                      result="shape"
                    />
                    <feGaussianBlur
                      result="effect1_foregroundBlur_1135_42"
                      stdDeviation="19.9"
                    />
                  </filter>
                  <filter
                    colorInterpolationFilters="sRGB"
                    filterUnits="userSpaceOnUse"
                    height="995.6"
                    id="filter1_f_1135_42"
                    width="1510.6"
                    x="-74.8"
                    y="-580.254"
                  >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend
                      in="SourceGraphic"
                      in2="BackgroundImageFix"
                      mode="normal"
                      result="shape"
                    />
                    <feGaussianBlur
                      result="effect1_foregroundBlur_1135_42"
                      stdDeviation="19.9"
                    />
                  </filter>
                  <linearGradient
                    gradientUnits="userSpaceOnUse"
                    id="fade"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="100"
                  >
                    <stop offset="0" stopColor="currentColor" />
                    <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                  <motion.linearGradient
                    animate={{
                      gradientTransform: [
                        'rotate(0 0 0) translate(0 50)',
                        'rotate(-6 0 0) translate(0 -100)',
                      ],
                      opacity: [0.7, 1],
                    }}
                    gradientUnits="userSpaceOnUse"
                    id="paint0_linear_1135_42"
                    transition={{
                      duration: 3,
                      delay: 1,
                      ease: 'easeInOut',
                      repeatType: 'reverse',
                      repeat: Number.POSITIVE_INFINITY,
                    }}
                    x1="680.5"
                    x2="680.5"
                    y1="-540.454"
                    y2="375.546"
                  >
                    <stop offset="0.721154" stopColor="currentColor" />
                    <stop offset="0.894231" stopColor="#005EFF" />
                    <stop offset="1" stopColor="#C8A4FF" />
                  </motion.linearGradient>
                  <linearGradient
                    gradientUnits="userSpaceOnUse"
                    id="paint1_linear_1135_42"
                    x1="871.335"
                    x2="574.374"
                    y1="0.285129"
                    y2="340.111"
                  >
                    <stop stopOpacity="0" />
                    <stop offset="1" stopColor="currentColor" />
                  </linearGradient>
                  <motion.linearGradient
                    animate={{
                      gradientTransform: [
                        'rotate(0 0 0) translate(0 300)',
                        'rotate(4 0 0) translate(0 -100)',
                      ],
                    }}
                    gradientUnits="userSpaceOnUse"
                    id="paint2_linear_1135_42"
                    transition={{
                      duration: 4,
                      ease: 'easeInOut',
                      repeatType: 'reverse',
                      repeat: Number.POSITIVE_INFINITY,
                    }}
                    x1="635.277"
                    x2="838.798"
                    y1="-1.70228e-06"
                    y2="906.327"
                  >
                    <stop
                      offset="0.721154"
                      stopColor="currentColor"
                      stopOpacity="0"
                    />
                    <stop offset="0.894231" stopColor="#005EFF" />
                    <stop offset="1" stopColor="#C8A4FF" />
                  </motion.linearGradient>
                  <clipPath id="clip0_1135_42">
                    <rect fill="white" height="353" width="1361" />
                  </clipPath>
                </defs>
              </svg>
            </motion.div>
          </div>
        </div>
      </section>
    </SectionContainer>
  );
}
