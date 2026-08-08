import { createRoot } from "react-dom/client";

import "../../src/styles/globals.css";
import { LandingPage } from "../../src/features/www/landing/landing-page";

createRoot(document.getElementById("root")!).render(<LandingPage />);
