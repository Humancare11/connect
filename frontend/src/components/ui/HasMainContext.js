import { createContext } from "react";

// True when AppLayout already wraps the routed page in <main id="main-content">.
// Pages that can render outside any layout (the 404) add their own <main> when it is false.
export const HasMainContext = createContext(true);
