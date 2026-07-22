import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";

// 1. ดึงค่า Config มาจากไฟล์ .env.local พร้อมบังคับ Type ให้เป็น string
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "git add .",
  authDomain: "mrtestdb.firebaseapp.com",
  projectId: "mrtestdb",
  storageBucket: "mrtestdb.firebasestorage.app",
  messagingSenderId: "898926657531",
  appId: "1:898926657531:web:4c56d0f6905df75616d55e"
};

// 2. ตรวจสอบว่า Firebase ถูก Initialize หรือยัง
// เพื่อป้องกัน Error "Firebase: No Firebase App '[DEFAULT]' has been created"
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 3. เรียกใช้งานบริการต่างๆ ของ Firebase
const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);

// 4. ส่งออก (Export) ตัวแปรไปให้หน้าเว็บอื่นๆ ใช้งาน
export { app, db, auth };