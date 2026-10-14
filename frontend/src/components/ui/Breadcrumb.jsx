import { Fragment } from "react";
import { Link, useLocation } from "react-router-dom";
import { breadcrumbItems } from "../../seo/schema";
import "./Breadcrumb.css";

// Visible breadcrumb trail (Home > Category > Page) built from the current path with the same helper
// that feeds the BreadcrumbList JSON-LD, so the page and its structured data always agree.
//   tone="light" is for dark hero backgrounds.
export default function Breadcrumb({ tone = "dark", className = "" }) {
  const { pathname } = useLocation();
  const items = breadcrumbItems(pathname);
  if (items.length < 2) return null;
  return (
    <nav aria-label="Breadcrumb" className={`hc-breadcrumb hc-breadcrumb--${tone}${className ? ` ${className}` : ""}`}>
      <ol className="hc-breadcrumb__list">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={it.path}>
              <li className="hc-breadcrumb__item">
                {last ? (
                  <span aria-current="page">{it.name}</span>
                ) : (
                  <Link to={it.path} className="hc-breadcrumb__link">
                    {it.name}
                  </Link>
                )}
              </li>
              {!last && (
                <li className="hc-breadcrumb__sep" aria-hidden="true">
                  ›
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
