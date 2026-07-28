"use client";

import React, { useState } from 'react';
import { doc, getDoc, collection, addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from '../lib/firebase';
import { useZxing } from "react-zxing"; 

interface LeaveRequest {
  id?: string;
  studentName: string;
  studentId: string;
  classroom: string;
  leaveType: string;
  status: string;
  approvedBy?: string;
  approvedAt?: any; 
  actionAt?: any; // ✅ เพิ่ม Field actionAt ที่ส่งมาจากหน้า Teacher
  createdAt?: any; 
  isUsed?: boolean; 
}

export default function GuardPage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  const [isScanning, setIsScanning] = useState<boolean>(false); 
  const [isLoading, setIsLoading] = useState<boolean>(false); 
  const [studentData, setStudentData] = useState<LeaveRequest | null>(null);
  const [scanError, setScanError] = useState<string>('');
  const [errorTitle, setErrorTitle] = useState<string>('ไม่อนุญาต !'); 
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false); 

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (username === 'guard' && password === '1234') {
      setIsLoggedIn(true);
      setLoginError('');
      setIsScanning(true);
    } else {
      setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  const { ref } = useZxing({
    paused: !isScanning || !isLoggedIn, 
    constraints: { video: { facingMode: "environment" } },
    onDecodeResult(result: any) {
      let extractedText = "";

      if (result) {
        if (typeof result === 'string') {
          extractedText = result;
        } else if (result.rawValue && typeof result.rawValue === 'string') {
          extractedText = result.rawValue; 
        } else if (result.text && typeof result.text === 'string') {
          extractedText = result.text;
        } else if (typeof result.getText === 'function') {
          extractedText = result.getText();
        } else {
          try {
            extractedText = JSON.stringify(result);
          } catch (e) {
            extractedText = String(result);
          }
        }
      }

      handleScanResult(extractedText);
    },
  });

  const handleScanResult = async (scannedText: string) => {
    setIsScanning(false);
    setIsLoading(true);
    setScanError('');
    setErrorTitle('ไม่อนุญาต !');
    setSaveSuccess(false);

    try {
      const safeText = scannedText ? scannedText.trim() : "";

      if (!safeText) {
        setErrorTitle("สแกนล้มเหลว");
        setScanError("กล้องไม่สามารถอ่านข้อมูลจาก QR Code ได้");
        setIsLoading(false);
        return;
      }

      if (!safeText.includes("MRW-PASS:")) {
        setErrorTitle("QR Code ผิดรูปแบบ");
        setScanError(`ข้อมูลที่สแกนได้: ${safeText.substring(0, 40)}...`);
        setIsLoading(false);
        return;
      }

      let rawRequestId = safeText.split("MRW-PASS:")[1]?.trim();
      const match = rawRequestId?.match(/^[a-zA-Z0-9_-]+/);
      const requestId = match ? match[0] : "";

      if (!requestId) {
        setErrorTitle("ข้อมูลไม่สมบูรณ์");
        setScanError("พบรูปแบบ MRW-PASS แต่ไม่สามารถดึงรหัสอ้างอิงได้");
        setIsLoading(false);
        return;
      }

      const docRef = doc(db, "LeaveRequests", requestId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as LeaveRequest;

        // 1. ตรวจสอบว่า QR Code ถูกสแกนซ้ำ (ใช้งานไปแล้ว) หรือไม่
        if (data.isUsed === true) {
          setErrorTitle("ไม่ผ่าน !");
          setScanError("QR Code นี้ถูกใช้งานไปแล้ว ไม่สามารถสแกนซ้ำได้");
          setIsLoading(false);
          return;
        }

        // 2. ตรวจสอบเวลาว่าเกิน 24 ชั่วโมงหรือไม่ (รองรับทั้ง actionAt, approvedAt และ createdAt)
        const requestTimestamp = data.actionAt || data.createdAt || data.approvedAt; 
        if (requestTimestamp && typeof requestTimestamp.toDate === 'function') {
          const reqTime = requestTimestamp.toDate().getTime(); 
          const now = Date.now();
          const hoursPassed = (now - reqTime) / (1000 * 60 * 60); 

          if (hoursPassed > 24) {
            setErrorTitle("ไม่ผ่าน !");
            setScanError("QR code หมดเวลาแล้ว (สร้างมาเกิน 24 ชั่วโมง)");
            setIsLoading(false);
            return;
          }
        }

        // หากผ่านเงื่อนไข นำข้อมูลมาเตรียมแสดงผล
        setStudentData({ id: docSnap.id, ...data });

        if (data.status === 'approved') {
          await updateDoc(docRef, {
            isUsed: true
          });

          await addDoc(collection(db, "ScanLogs"), {
            requestId: docSnap.id,
            studentName: data.studentName || "ไม่ระบุ",
            studentId: data.studentId || "ไม่ระบุ",
            classroom: data.classroom || "ไม่ระบุ",
            leaveType: data.leaveType || "ไม่ระบุ",
            action: "Scanned at Gate", 
            scannedAt: serverTimestamp(), 
            scannedBy: username || "Guard" 
          });
          
          setSaveSuccess(true); 
        } else {
          setErrorTitle("ไม่อนุญาต !");
          setScanError("คำร้องนี้ยังไม่ได้รับการอนุมัติ หรือถูกปฏิเสธ");
        }
      } else {
        setErrorTitle("ไม่พบข้อมูล");
        setScanError(`ไม่พบรหัสคำร้อง [${requestId}] ในฐานข้อมูล (อาจถูกลบไปแล้ว)`);
      }
    } catch (error: any) {
      console.error("Error processing scan:", error);
      setErrorTitle("ระบบขัดข้อง");
      setScanError(error?.message || "ไม่สามารถเชื่อมต่อฐานข้อมูลได้");
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanNext = () => {
    setStudentData(null);
    setScanError('');
    setSaveSuccess(false);
    setIsScanning(true); 
  };

  // ✅ ฟังก์ชันช่วยแปลงเวลาให้แสดงผลถูกต้อง
  const getApprovalTime = (data: LeaveRequest) => {
    const timeData = data.actionAt || data.approvedAt;
    if (!timeData) return '-';
    
    try {
      if (typeof timeData.toDate === 'function') {
        return timeData.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
      }
      return new Date(timeData).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
    } catch (e) {
      return '-';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-5 relative font-sans">
      
      {!isLoggedIn ? (
        <div className="w-full max-w-sm bg-slate-800 rounded-3xl shadow-2xl p-8 border-t-4 border-blue-500">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-slate-700 text-blue-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">🛡️</div>
            <h1 className="text-2xl font-bold text-white">ระบบรักษาความปลอดภัย</h1>
            <p className="text-slate-400 mt-1 text-sm">MRW E-Pass Scanner</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ชื่อผู้ใช้ (guard)" className="w-full bg-slate-900 border border-slate-700 text-white p-3.5 rounded-xl focus:outline-none focus:border-blue-500" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่าน (1234)" className="w-full bg-slate-900 border border-slate-700 text-white p-3.5 rounded-xl focus:outline-none focus:border-blue-500" />
            
            {loginError && <p className="text-red-400 text-sm text-center bg-red-900/30 p-2 rounded-lg">{loginError}</p>}
            
            <div className="grid grid-cols-2 gap-3 mt-2">
              <a 
                href="/" 
                className="w-full bg-slate-700 text-slate-300 hover:text-white font-bold py-3.5 rounded-xl hover:bg-slate-600 transition flex items-center justify-center gap-1.5 text-sm shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                กลับหน้าหลัก
              </a>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition shadow-lg shadow-blue-900/50 text-sm">
                เข้าสู่ระบบ
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <button 
            onClick={() => { setIsLoggedIn(false); setIsScanning(false); }}
            className="absolute top-6 right-6 text-slate-400 hover:text-white text-sm font-medium flex items-center gap-2 transition z-20"
          >
            ออกจากระบบ
          </button>

          {isScanning && (
            <div className="w-full max-w-sm flex flex-col items-center">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white">สแกน QR Code</h2>
                <p className="text-slate-400 mt-1">ให้นักเรียนแสดงใบผ่านทาง E-Passport</p>
              </div>
              
              <div className="w-full aspect-[4/5] bg-black rounded-3xl overflow-hidden relative shadow-2xl border-4 border-slate-800">
                <video ref={ref} className="w-full h-full object-cover" playsInline />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center border-[40px] border-slate-900/60">
                  <div className="w-full h-full border-2 border-blue-500/50 rounded-xl relative">
                     <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1 rounded-tl-lg"></div>
                     <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1 rounded-tr-lg"></div>
                     <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1 rounded-bl-lg"></div>
                     <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1 rounded-br-lg"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="text-center text-white">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="font-bold">กำลังตรวจสอบข้อมูล...</p>
            </div>
          )}

          {scanError && !isLoading && (
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
              <div className="bg-red-500 p-8 text-center text-white">
                <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center mb-4">
                  <span className="text-4xl">❌</span>
                </div>
                <h2 className="text-3xl font-bold">{errorTitle}</h2>
                <p className="text-red-100 mt-2 font-medium text-sm leading-relaxed break-all">{scanError}</p>
              </div>
              <div className="p-4 bg-slate-50">
                <button onClick={handleScanNext} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700">สแกนใหม่</button>
              </div>
            </div>
          )}

          {studentData && !isLoading && !scanError && (
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-bounce" style={{ animationIterationCount: 1 }}>
              
              <div className={`${studentData.status === 'approved' ? 'bg-green-500' : 'bg-red-500'} p-8 text-center text-white relative`}>
                <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center mb-4 shadow-inner">
                  {studentData.status === 'approved' ? (
                    <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
                  ) : (
                    <span className="text-4xl">❌</span>
                  )}
                </div>
                <h2 className="text-3xl font-bold">
                  {studentData.status === 'approved' ? 'ผ่านได้ !' : 'ไม่อนุญาต !'}
                </h2>
                <p className="text-white/90 mt-1 font-medium text-sm">
                  {studentData.status === 'approved' ? 'ข้อมูลถูกต้องและได้รับการอนุมัติ' : 'คำร้องนี้ยังไม่ได้รับการอนุมัติ'}
                </p>
                
                {saveSuccess && (
                  <div className="mt-3 bg-green-700/40 py-1.5 px-4 rounded-full inline-block text-xs font-semibold backdrop-blur-sm border border-green-400/30">
                    ✅ บันทึกเวลาเข้า-ออกเรียบร้อยแล้ว
                  </div>
                )}
              </div>
              
              <div className="p-6 text-center">
                <h3 className="text-xl font-bold text-slate-800">{studentData.studentName}</h3>
                <p className="text-slate-500 font-medium text-sm mb-2">{studentData.classroom} • {studentData.leaveType}</p>
                <p className="text-sm text-slate-600 bg-slate-100 p-2 rounded-lg inline-block">รหัส: {studentData.studentId}</p>
                
                <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between text-xs text-slate-400 text-left">
                  <div>
                    <p className="font-semibold text-slate-600">ผู้อนุมัติ:</p>
                    <p>{studentData.approvedBy || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-600">เวลาที่อนุมัติ:</p>
                    {/* ✅ เรียกใช้งานฟังก์ชันที่สร้างไว้ด้านบน */}
                    <p>{getApprovalTime(studentData)}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50">
                <button onClick={handleScanNext} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-700 transition shadow-md">
                  สแกนคิวอาร์โค้ดต่อไป
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}