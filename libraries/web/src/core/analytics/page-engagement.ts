import * as Option from "effect/Option";
import * as P from "effect/Predicate";

/** Interactions quicker than this cannot be a page's worst one worth reporting. */
const SLOW_INTERACTION_MS = 40;
const ENTRY_TYPES = ["largest-contentful-paint", "event", "layout-shift"];

const roundScore = (value: number) => Math.round(value * 10_000) / 10_000;
const roundPositive = (value: number) => (value > 0 ? Math.round(value) : undefined);

/**
 * Measures one page view from now until `stop`: its visible time, how far it
 * was scrolled, and its Web Vitals. All of it is cheap and passive: the browser
 * hands over the entries, and scroll position is read at most once per frame.
 *
 * With `isLanding`, the page view is the first of the document, which has the
 * load to report: it also takes what the browser measured before the SDK
 * started, and has an LCP. A client-side navigation has no LCP of its own.
 */
export const measurePageView = (options: {
  readonly isLanding: boolean;
  readonly onHidden: () => void;
  readonly onVisible: () => void;
}) => {
  const { isLanding } = options;
  const isVisible = () => document.visibilityState === "visible";
  const root = document.documentElement;

  const startedAt = isLanding ? 0 : performance.now();
  let visibleMs = 0;
  // When the page last became visible; negative while it is hidden.
  let visibleSince = isVisible() ? performance.now() : -1;
  let firstHiddenAt = isVisible() ? Number.POSITIVE_INFINITY : 0;
  const visibleTime = () => visibleMs + (visibleSince < 0 ? 0 : performance.now() - visibleSince);

  const onVisibilityChange = () => {
    if (isVisible()) {
      visibleSince = performance.now();
      options.onVisible();
      return;
    }
    visibleMs = visibleTime();
    visibleSince = -1;
    firstHiddenAt = Math.min(firstHiddenAt, performance.now());
    options.onHidden();
  };

  let deepestScroll = 0;
  let scrollFrame = 0;
  /**
   * How far the page can scroll, kept current while the page view lasts, and
   * not read when it ends: a client-side navigation may have rendered the next
   * page by then. Unknown until first measured.
   */
  let scrollRange = Number.NaN;
  const measureScrollRange = () => {
    scrollRange = root.scrollHeight - window.innerHeight;
  };
  const onScroll = () => {
    scrollFrame ||= requestAnimationFrame(() => {
      scrollFrame = 0;
      measureScrollRange();
      if (scrollRange > 0) deepestScroll = Math.max(deepestScroll, window.scrollY / scrollRange);
    });
  };

  let lcp = 0;
  let inp = 0;
  // The largest session window of layout shifts, as Core Web Vitals counts them:
  // shifts less than a second apart, over at most five seconds.
  let cls = 0;
  let windowValue = 0;
  let windowStart = 0;
  let windowEnd = Number.NEGATIVE_INFINITY;
  const onEntry = (entry: PerformanceEntry) => {
    const { startTime } = entry;
    // Delivered after a navigation, but from before it.
    if (startTime < startedAt) return;
    if (entry.entryType === "largest-contentful-paint") {
      // A paint after the page was hidden says when it was shown again.
      if (isLanding && startTime < firstHiddenAt) lcp = startTime;
    } else if ("interactionId" in entry) {
      if (entry.interactionId) inp = Math.max(inp, entry.duration);
    } else if ("value" in entry && P.isNumber(entry.value)) {
      if ("hadRecentInput" in entry && entry.hadRecentInput) return;
      if (startTime - windowEnd >= 1_000 || startTime - windowStart >= 5_000) {
        windowValue = 0;
        windowStart = startTime;
      }
      windowEnd = startTime;
      windowValue += entry.value;
      cls = Math.max(cls, windowValue);
    }
  };

  // Without these, as in test environments and older browsers, what they would
  // measure goes unreported rather than throwing into the customer's page. An
  // unsupported type would only warn in their console, and report a false zero.
  let performanceObserver = Option.none<PerformanceObserver>();
  let hasLayoutShifts = false;
  Option.liftThrowable(() => {
    const observer = new PerformanceObserver((list) => list.getEntries().forEach(onEntry));
    performanceObserver = Option.some(observer);
    ENTRY_TYPES.filter((type) => PerformanceObserver.supportedEntryTypes.includes(type)).forEach(
      (type) => {
        const init = { buffered: isLanding, durationThreshold: SLOW_INTERACTION_MS, type };
        observer.observe(init);
        hasLayoutShifts ||= type === "layout-shift";
      },
    );
  })();
  let resizeObserver = Option.none<ResizeObserver>();
  Option.liftThrowable(() => {
    const observer = new ResizeObserver(measureScrollRange);
    resizeObserver = Option.some(observer);
    observer.observe(root);
  })();

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("scroll", onScroll, { passive: true });

  return {
    /** The `$pageleave` properties as of now. */
    read: () => {
      // An entry of the page's last moments may not have been delivered yet.
      Option.map(performanceObserver, (observer) => observer.takeRecords().forEach(onEntry));
      // Nothing measured it: a page that never rendered, or no `ResizeObserver`.
      if (Number.isNaN(scrollRange)) measureScrollRange();
      return {
        cls: hasLayoutShifts ? roundScore(cls) : undefined,
        duration_ms: Math.round(visibleTime()),
        inp_ms: roundPositive(inp),
        lcp_ms: roundPositive(lcp),
        max_scroll_percent:
          scrollRange > 0 || deepestScroll > 0 ? roundScore(Math.min(deepestScroll, 1)) : 1,
      };
    },
    stop: () => {
      Option.map(performanceObserver, (observer) => observer.disconnect());
      Option.map(resizeObserver, (observer) => observer.disconnect());
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("scroll", onScroll);
    },
  };
};

/**
 * Calls `onOutboundClick` with the origin of every link to another origin a
 * person clicks, from anywhere in the page, shadow roots included: the origin
 * alone, as a link's path and query can hold private data. Listens in the
 * capture phase, as the page may stop the event, and for `auxclick` too, as a
 * middle click opens the link without a `click`. Returns the cleanup.
 */
export const observeOutboundClicks = (onOutboundClick: (targetOrigin: string) => void) => {
  const onClick = (event: MouseEvent) => {
    // The right button also fires `auxclick`, and only opens a menu.
    if (event.button > 1) return;
    const link = event
      .composedPath()
      .find(
        (target): target is HTMLAnchorElement | HTMLAreaElement =>
          target instanceof HTMLAnchorElement || target instanceof HTMLAreaElement,
      );
    if (link?.protocol.startsWith("http") && link.origin !== window.location.origin) {
      onOutboundClick(link.origin);
    }
  };
  const options = { capture: true, passive: true };
  document.addEventListener("click", onClick, options);
  document.addEventListener("auxclick", onClick, options);
  return () => {
    document.removeEventListener("click", onClick, options);
    document.removeEventListener("auxclick", onClick, options);
  };
};
