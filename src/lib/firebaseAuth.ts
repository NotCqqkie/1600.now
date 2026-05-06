import { getAuth } from "firebase/auth";
import { app, firebaseConfigError } from "@/lib/firebaseApp";

export { firebaseConfigError };
export const auth = app ? getAuth(app) : null;
