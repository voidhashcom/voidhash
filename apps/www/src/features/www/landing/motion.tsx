"use client";

import {
  animate,
  type MotionValue,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

/** Long, soft deceleration — reads well on data that is counting or growing towards a value. */
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/**
 * Whether the surrounding illustration has scrolled into view, or `null` outside one.
 *
 * The illustration owns the single observer and every animated part reads from it, so a mock's
 * charts, bars and figures all start together instead of tripping one by one. The `null` default
 * makes the parts render as plain static values when used outside an `Illustration`.
 */
const IllustrationInViewContext = createContext<boolean | null>(null);

/**
 * Marks a product mock whose contents animate in once it scrolls into view.
 *
 * Takes over an existing wrapper's `className` rather than adding a node of its own, because the
 * mocks are pixel-faithful exports whose layout is sensitive to extra boxes.
 */
export function Illustration({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2, once: true });

  return (
    <div className={className} ref={ref} style={style}>
      <IllustrationInViewContext.Provider value={inView}>
        {children}
      </IllustrationInViewContext.Provider>
    </div>
  );
}

type ParsedValue = { amount: number; format: (value: number) => string };

/** Splits "−$2,130" or "+25.9%" into prefix, number and suffix so the count-up can reformat it. */
function parseValue(value: string): ParsedValue | null {
  const match = /^([^\d]*)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(value);
  if (!match) {
    return null;
  }

  const [, prefix, digits, suffix] = match;
  const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
  const useGrouping = digits.includes(",");

  return {
    amount: Number(digits.replace(/,/g, "")),
    format: (current) =>
      prefix +
      current.toLocaleString("en-US", {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
        useGrouping,
      }) +
      suffix,
  };
}

/**
 * Counts a figure up to its final value when its illustration scrolls into view.
 *
 * Renders the real value on the server and writes to the DOM node directly while animating, so a
 * mock full of figures neither breaks hydration nor re-renders React on every frame.
 */
export function CountUp({
  className,
  delay = 0,
  value,
}: {
  className?: string;
  delay?: number;
  value: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useContext(IllustrationInViewContext);
  const prefersReducedMotion = useReducedMotion();
  const parsed = useMemo(() => parseValue(value), [value]);

  useEffect(() => {
    const node = ref.current;
    if (!node || !parsed || inView === null || prefersReducedMotion) {
      return;
    }

    if (!inView) {
      node.textContent = parsed.format(0);
      return;
    }

    const controls = animate(0, parsed.amount, {
      delay,
      duration: 1.2,
      ease: EASE_OUT,
      onUpdate: (current) => {
        node.textContent = parsed.format(current);
      },
    });

    return () => controls.stop();
  }, [delay, inView, parsed, prefersReducedMotion]);

  return (
    <span className={className} ref={ref}>
      {value}
    </span>
  );
}

/** Wipes a chart in from the left once its illustration scrolls into view. */
export function ChartWipe({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const inView = useContext(IllustrationInViewContext);
  const prefersReducedMotion = useReducedMotion();
  const drawn = inView !== false || prefersReducedMotion;

  return (
    <motion.div
      animate={{ clipPath: drawn ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)" }}
      className={className}
      initial={false}
      transition={{ delay, duration: 1.3, ease: [0.33, 1, 0.68, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Grows a fixed-width bar out from its left edge once its illustration scrolls into view. */
export function GrowBar({ className, delay = 0 }: { className?: string; delay?: number }) {
  const inView = useContext(IllustrationInViewContext);
  const prefersReducedMotion = useReducedMotion();
  const grown = inView !== false || prefersReducedMotion;

  return (
    <motion.div
      animate={{ scaleX: grown ? 1 : 0 }}
      className={className}
      initial={false}
      style={{ transformOrigin: "left" }}
      transition={{ delay, duration: 1, ease: EASE_OUT }}
    />
  );
}

// zinc-600 and white. Kept as literal hex rather than `var(--zinc-600)` because
// these are motion tween endpoints — the interpolator needs a concrete colour.
// Keep in sync with the ramp in packages/ui/styles/brand-theme.css.
const WORD_DIM = "#52525C";
const WORD_BRIGHT = "#FFFFFF";

/** How many word slots a single word takes to go from dim to bright; >1 overlaps neighbours. */
const WORD_WINDOW_SLOTS = 1.8;

/**
 * Brightens copy word by word as the block scrolls through the viewport.
 *
 * Each word owns a slice of the block's scroll progress and neighbouring slices overlap, so the
 * sweep reads as a continuous wipe rather than a row of words flipping one at a time.
 */
export function ScrollBrightenText({ className, text }: { className?: string; text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    offset: ["start 0.9", "end 0.3"],
    target: ref,
  });
  const words = useMemo(() => text.split(" "), [text]);

  const windowSize = Math.min(1, WORD_WINDOW_SLOTS / words.length);
  const step = words.length > 1 ? (1 - windowSize) / (words.length - 1) : 0;

  return (
    <p className={className} ref={ref}>
      {words.map((word, index) => (
        <BrightenedWord
          end={index * step + windowSize}
          key={`${index}-${word}`}
          progress={scrollYProgress}
          start={index * step}
        >
          {index === words.length - 1 ? word : `${word} `}
        </BrightenedWord>
      ))}
    </p>
  );
}

function BrightenedWord({
  children,
  end,
  progress,
  start,
}: {
  children: string;
  end: number;
  progress: MotionValue<number>;
  start: number;
}) {
  const color = useTransform(progress, [start, end], [WORD_DIM, WORD_BRIGHT]);

  return <motion.span style={{ color }}>{children}</motion.span>;
}
