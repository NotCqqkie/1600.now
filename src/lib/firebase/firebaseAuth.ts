import { getAuth } from "firebase/auth";
import { app, firebaseConfigError } from "@/lib/firebase/firebaseApp";

export { firebaseConfigError };
export const auth = app ? getAuth(app) : null;
