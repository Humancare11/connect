import { forwardRef } from "react";
import { Link } from "react-router-dom";
import "./Button.css";

// Shared button. Look copied from the specialty-page buttons (.sp-btn / .sp-btn--primary-lg in
// pages/Specialty/SpecialtyPage.css), the most used button style on the site: pill shape, 700 weight,
// #0b57e8 primary with a soft blue shadow.
//   variant: "primary" | "secondary" | "ghost" | "danger"      size: "sm" | "md" | "lg"
//   loading: shows a spinner, sets aria-busy and disables the control
//   href  -> renders <a>;  to -> renders a react-router <Link>;  otherwise <button>
const Button = forwardRef(function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  href,
  to,
  type = "button",
  className = "",
  children,
  ...rest
}, ref) {
  const cls = `hc-ui-btn hc-ui-btn--${variant} hc-ui-btn--${size}${className ? ` ${className}` : ""}`;
  const content = (
    <>
      {loading && <span className="hc-ui-btn__spinner" aria-hidden="true" />}
      {children}
    </>
  );
  const busy = loading ? { "aria-busy": true } : {};

  if (to) {
    return (
      <Link ref={ref} to={to} className={cls} {...busy} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a ref={ref} href={href} className={cls} {...busy} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} {...busy} {...rest}>
      {content}
    </button>
  );
});

export default Button;
