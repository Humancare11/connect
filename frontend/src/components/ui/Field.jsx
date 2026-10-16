import { cloneElement, isValidElement, useId } from "react";
import "./Field.css";

// Label + control + hint + error. Look copied from the sign-in form fields (.hc-input in Login.css).
//   <Field label="Email" hint="We never share it" error={errors.email} required>
//     <input type="email" ... />            (or a <select> / <textarea>; use the `as` shortcut below instead)
//   </Field>
//   <Field label="Email" type="email" value={v} onChange={...} />   renders its own <input>
// The child control gets id, aria-invalid and aria-describedby; the error has role="alert".
export default function Field({ label, hint, error, required = false, as = "input", children, className = "", ...controlProps }) {
  const autoId = useId();
  const id = controlProps.id || `field-${autoId}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const shared = {
    id,
    "aria-invalid": error ? "true" : undefined,
    "aria-describedby": describedBy,
    required: required || undefined,
  };
  const Tag = as;
  const control = isValidElement(children) ? (
    cloneElement(children, { ...shared, className: `hc-field__control ${children.props.className || ""}`.trim() })
  ) : (
    <Tag {...controlProps} {...shared} className={`hc-field__control ${controlProps.className || ""}`.trim()}>
      {children}
    </Tag>
  );

  return (
    <div className={`hc-field${error ? " hc-field--error" : ""}${className ? ` ${className}` : ""}`}>
      {label && (
        <label htmlFor={id} className="hc-field__label">
          {label}
          {required && (
            <span className="hc-field__req" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </label>
      )}
      {control}
      {hint && (
        <p id={hintId} className="hc-field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="hc-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
