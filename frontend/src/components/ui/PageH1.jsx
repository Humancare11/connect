// Visually hidden page title (<h1>) for dashboard screens whose visible title is not a heading.
// Placed next to the page component in the route so loading/error states also have exactly one h1.
export default function PageH1({ children }) {
  return <h1 className="sr-only">{children}</h1>;
}
