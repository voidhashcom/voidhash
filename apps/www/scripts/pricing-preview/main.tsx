import { createRoot } from "react-dom/client";

import "../../src/styles/globals.css";
import { PricingPage } from "../../src/features/www/pricing/pricing-page";

createRoot(document.getElementById("root")!).render(<PricingPage />);
