import { getFirestore } from "firebase/firestore";
import { app } from "@/lib/firebaseApp";

export const db = app ? getFirestore(app) : null;
