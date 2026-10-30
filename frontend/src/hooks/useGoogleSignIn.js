import { useGoogleLogin } from "@react-oauth/google";
import { googleEnabled } from "../utils/googleAuth";

const startNothing = () => () => {};

// useGoogleLogin when this build has a Google client id, otherwise a function that does nothing (the login pages do not show the
// Google button then, see googleEnabled). Chosen once at load, never between renders, so the hook order is stable.
export const useGoogleSignIn = googleEnabled ? useGoogleLogin : startNothing;
