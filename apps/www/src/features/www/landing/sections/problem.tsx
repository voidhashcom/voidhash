import { ScrollBrightenText } from "../motion";
import { LandingSection } from "../shared";

const PROBLEM_COPY =
  "Building apps is easy now. Growing them has never been harder. Voidhash brings all the tools you need to build, test, iterate and grow quickly.";

/** Renders the landing page positioning statement. */
export function LandingProblem() {
  return (
    <LandingSection>
      <div className="flex items-center px-6 py-24 md:px-12 md:py-32 xl:px-32 xl:py-48">
        <ScrollBrightenText
          className="max-w-[899px] font-medium font-sans text-[28px] leading-[130%] tracking-[-0.03em] md:text-[34px] xl:text-[40px]"
          text={PROBLEM_COPY}
        />
      </div>
    </LandingSection>
  );
}
