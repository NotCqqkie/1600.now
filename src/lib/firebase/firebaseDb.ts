import { getFirestore } from "firebase/firestore";
import { app } from "@/lib/firebase/firebaseApp";

export const db = app ? getFirestore(app) : null;
