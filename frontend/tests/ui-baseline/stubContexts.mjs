// A Vite plugin that swaps the sign-in contexts and the socket for fixed stand-ins, so a layout renders signed in
// without a backend. Only used by the screenshot tool; nothing in src/ is changed.
import path from "node:path";

const ROLE = "(window.__HARNESS_ROLE || '')";

const stubs = {
  "AdminContext.jsx": `
    import { createContext } from "react";
    export const AdminContext = createContext(null);
    const roles = { admin: "admin", superadmin: "superadmin", paymentadmin: "paymentadmin", portal: "superadmin" };
    const names = { admin: "Test Admin", superadmin: "Test Super Admin", paymentadmin: "Test Payment Admin", portal: "Test Super Admin" };
    export const useAdmin = () => {
      const key = ${ROLE};
      return { admin: { _id: "a1", name: names[key] || "Test Admin", email: "admin@example.test", role: roles[key] || "admin" }, loading: false, logout: async () => {} };
    };
    export const AdminProvider = ({ children }) => children;
  `,
  "DoctorAuthContext.jsx": `
    export const useDoctorAuth = () => ({ doctor: { _id: "d1", name: "Dr. Asha Rao", email: "asha@example.test", isEnrolled: true }, loading: false, logout: async () => {} });
    export const DoctorAuthProvider = ({ children }) => children;
  `,
  "AuthContext.jsx": `
    export const useAuth = () => ({ user: { _id: "u1", name: "Priya Sharma", email: "priya@example.test", role: "user" }, loading: false, logout: async () => {} });
    export const AuthProvider = ({ children }) => children;
  `,
  "EmployeeAdminContext.jsx": `
    export const useEmployeeAdmin = () => ({ employeeAdmin: { _id: "e1", name: "Satish Kumar", email: "satish@example.test" }, loading: false, logout: async () => {} });
    export const EmployeeAdminProvider = ({ children }) => children;
  `,
  "PartnerContext.jsx": `
    export const usePartner = () => ({ partnerUser: { _id: "p1", name: "Partner User" }, partner: { companyName: "Acme Health" }, loading: false, logout: async () => {} });
    export const PartnerProvider = ({ children }) => children;
  `,
};

const socketStub = `
  const noop = () => {};
  const socket = { connected: false, on: noop, off: noop, once: noop, emit: noop, connect: noop, disconnect: noop, io: { on: noop, off: noop }, auth: {} };
  export default socket;
  export const setSocketAuthRole = noop;
`;

export default function stubContexts() {
  return {
    name: "ui-baseline-stubs",
    enforce: "pre",
    load(id) {
      const clean = id.split("?")[0].split(path.sep).join("/");
      for (const [file, code] of Object.entries(stubs)) if (clean.endsWith(`/src/context/${file}`)) return code;
      if (clean.endsWith("/src/socket.js")) return socketStub;
      return null;
    },
  };
}
