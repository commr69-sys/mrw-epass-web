"use client";

import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, getDoc } from "firebase/firestore"; 
import { db } from '../lib/firebase'; 
import { QRCodeCanvas } from 'qrcode.react';

interface LeaveRequest {
  id: string;
  studentName: string;
  studentId: string;
  classroom: string;
  leaveType: string;
  reason: string;
  status: string;
  createdAt: any;
}

// สร้าง Interface สำหรับเก็บข้อมูลนักเรียนที่ Login สำเร็จ
interface StudentData {
  studentId: string;
  studentName: string;
  classroom: string;
}

export default function StudentPage() {
  // ==========================================
  // States: ระบบ Login & ข้อมูลผู้ใช้
  // ==========================================
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false); // สถานะกำลังโหลดตอน Login
  
  // เก็บข้อมูลนักเรียนที่ได้จาก Database หลัง Login สำเร็จ
  const [currentStudent, setCurrentStudent] = useState<StudentData | null>(null);
  
  // ==========================================
  // States: ระบบคำร้อง
  // ==========================================
  const [showForm, setShowForm] = useState<boolean>(false);
  const [leaveType, setLeaveType] = useState<string>('ลากิจ');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);

  // ----------------------------------------------------
  // ฟังก์ชัน Login (เชื่อมต่อกับ Firestore Collection: Students)
  // ----------------------------------------------------
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (username.trim() === '' || password.trim() === '') {
      setLoginError('กรุณากรอกรหัสนักเรียนและรหัสผ่านให้ครบถ้วน');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');

    try {
      // ค้นหาข้อมูลนักเรียนจาก Document ID (รหัสนักเรียน)
      const studentDocRef = doc(db, "Students", username.trim());
      const studentDoc = await getDoc(studentDocRef);

      if (studentDoc.exists()) {
        const data = studentDoc.data();
        
        // ตรวจสอบรหัสผ่าน
        if (data.password === password) {
          // Login สำเร็จ บันทึกข้อมูลนักเรียนลง State
          setCurrentStudent({
            studentId: username,
            studentName: data.studentName || 'ไม่ระบุชื่อ',
            classroom: data.classroom || 'ไม่ระบุชั้นเรียน'
          });
          setIsLoggedIn(true);
        } else {
          setLoginError('รหัสผ่านไม่ถูกต้อง');
        }
      } else {
        setLoginError('ไม่พบรหัสนักเรียนนี้ในระบบ');
      }
    } catch (error) {
      console.error("Login Error:", error);
      setLoginError('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ----------------------------------------------------
  // ดึงข้อมูลคำร้องแบบ Real-time
  // ----------------------------------------------------
  useEffect(() => {
    if (!isLoggedIn || !currentStudent) return;
    const q = query(collection(db, "LeaveRequests"), where("studentId", "==", currentStudent.studentId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs: LeaveRequest[] = [];
      snapshot.forEach((doc) => reqs.push({ id: doc.id, ...doc.data() } as LeaveRequest));
      
      reqs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setMyRequests(reqs);
    });
    return () => unsubscribe();
  }, [isLoggedIn, currentStudent]);

  // ----------------------------------------------------
  // ฟังก์ชันส่งคำร้อง (ใช้ข้อมูลจริงจาก Database)
  // ----------------------------------------------------
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (reason.trim() === "") {
      alert("กรุณาระบุเหตุผลการขออนุญาต");
      return;
    }
    if (!currentStudent) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "LeaveRequests"), {
        studentName: currentStudent.studentName, // ใช้ชื่อจริงจาก DB
        studentId: currentStudent.studentId,                
        classroom: currentStudent.classroom,     // ใช้ชั้นเรียนจริงจาก DB
        leaveType: leaveType,
        reason: reason,
        status: "pending", 
        createdAt: serverTimestamp()
      });

      try {
        const lineMessage = `\n🔔 มีคำร้องขออนุญาตใหม่!\nรหัสนักเรียน: ${currentStudent.studentId}\nชื่อ: ${currentStudent.studentName}\nชั้น: ${currentStudent.classroom}\nประเภท: ${leaveType}\nเหตุผล: ${reason}`;
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: lineMessage })
        });
      } catch (lineError) {
        console.error("ส่ง LINE ไม่สำเร็จ: ", lineError);
      }

      alert("ส่งคำร้องสำเร็จ! กรุณารอครูที่ปรึกษาอนุมัติ");
      setReason('');
      setLeaveType('ลากิจ');
      setShowForm(false); 
    } catch (error) {
      console.error("Error adding document:", error);
      alert("เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // Helper functions
  // ----------------------------------------------------
  const downloadQRCode = (requestId: string) => {
    const canvas = document.getElementById(`qr-${requestId}`) as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement('a');
    link.href = url;
    link.download = `E-Passport-${requestId}.png`;
    link.click();
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp || !timestamp.toDate) return 'กำลังดำเนินการ...';
    return timestamp.toDate().toLocaleDateString('th-TH', { 
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) + ' น.';
  };

  const totalRequests = myRequests.length;
  const approvedCount = myRequests.filter(req => req.status === 'approved').length;
  const rejectedCount = myRequests.filter(req => req.status === 'rejected').length;
  const latestApproved = myRequests.find(req => req.status === 'approved');

  // ==========================================
  // UI - หน้า Login
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center p-5 font-sans">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm flex flex-col gap-4 border-t-8 border-blue-600 relative overflow-hidden">
          
          {/* สถานะกำลังโหลด Login (แสดงตอนดึงข้อมูลจาก DB) */}
          {isLoggingIn && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
              <p className="text-blue-600 font-bold text-sm">กำลังตรวจสอบข้อมูล...</p>
            </div>
          )}

          <div className="text-center mb-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-2 shadow-inner">🎒</div>
            <h2 className="text-2xl font-bold text-slate-800">ระบบนักเรียน</h2>
            <p className="text-slate-500 text-sm">MRW E-Pass</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">รหัสนักเรียน</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="กรอกรหัสนักเรียน" className="w-full border border-slate-200 p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">รหัสผ่าน</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่าน" className="w-full border border-slate-200 p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          {loginError && <p className="text-red-500 text-sm font-medium text-center bg-red-50 p-2 rounded-lg">{loginError}</p>}
          <button type="submit" disabled={isLoggingIn} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 shadow-md transition mt-2 disabled:bg-slate-400">เข้าสู่ระบบ</button>
        </form>
      </div>
    );
  }

  // ==========================================
  // UI - หน้าหลักนักเรียน
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-100 pb-10 font-sans">
      <div className="bg-blue-600 text-white pt-12 pb-6 px-5 rounded-b-3xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-bold">MRW E-Pass</h1>
            <p className="text-blue-100 text-sm mt-1">{currentStudent?.studentName} ({currentStudent?.classroom})</p>
            <p className="text-blue-200 text-xs">รหัส: {currentStudent?.studentId}</p>
          </div>
          <div className="w-14 h-14 bg-white/20 text-white rounded-full flex items-center justify-center font-bold text-2xl shadow-sm border border-white/40">
            {currentStudent?.studentName.charAt(0) || 'ส'}
          </div>
        </div>
      </div>

      <div className="p-5 -mt-6 relative z-10 max-w-md mx-auto">
        
        {!showForm && latestApproved && (
          <div className="bg-white rounded-3xl shadow-xl border-t-8 border-green-500 overflow-hidden mb-6 animate-fade-in">
            <div className="p-6 bg-slate-50 flex flex-col items-center justify-center text-center">
              <span className="inline-block bg-green-100 text-green-700 px-4 py-1 rounded-full text-xs font-bold mb-3 shadow-sm">
                อนุมัติล่าสุด (Active E-Pass)
              </span>
              <h2 className="text-xl font-bold text-slate-800">{latestApproved.leaveType}</h2>
              <p className="text-slate-500 text-xs mt-1 mb-4">อนุมัติเมื่อ: {formatDate(latestApproved.createdAt)}</p>
              
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                <QRCodeCanvas id={`qr-${latestApproved.id}`} value={`MRW-PASS:${latestApproved.id}`} size={160} level={"H"} />
              </div>
              
              <p className="text-xs text-slate-400 mt-4 font-medium px-4">
                แสดง QR Code นี้ให้เจ้าหน้าที่รักษาความปลอดภัย ณ ประตูทางออก
              </p>
              <button onClick={() => downloadQRCode(latestApproved.id)} className="mt-3 text-sm text-blue-600 font-semibold hover:underline">
                ดาวน์โหลด QR Code
              </button>
            </div>
          </div>
        )}

        {!showForm && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white p-3 rounded-2xl shadow-sm text-center border border-slate-100">
                <p className="text-2xl font-bold text-blue-600">{totalRequests}</p>
                <p className="text-[10px] text-slate-500 font-medium">ยื่นขอทั้งหมด</p>
              </div>
              <div className="bg-white p-3 rounded-2xl shadow-sm text-center border border-green-100">
                <p className="text-2xl font-bold text-green-500">{approvedCount}</p>
                <p className="text-[10px] text-slate-500 font-medium">อนุมัติแล้ว</p>
              </div>
              <div className="bg-white p-3 rounded-2xl shadow-sm text-center border border-red-100">
                <p className="text-2xl font-bold text-red-500">{rejectedCount}</p>
                <p className="text-[10px] text-slate-500 font-medium">ไม่อนุมัติ</p>
              </div>
            </div>

            <button onClick={() => setShowForm(true)} type="button" className="w-full bg-blue-100 text-blue-700 py-3.5 rounded-xl font-bold shadow-sm flex items-center justify-center gap-2 hover:bg-blue-200 transition mb-6">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              สร้างคำร้องใบลาใหม่
            </button>
          </>
        )}

        {showForm ? (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h2 className="text-lg font-bold text-slate-800">เขียนใบขออนุญาต</h2>
              <button onClick={() => setShowForm(false)} type="button" className="text-slate-400 hover:text-red-500 text-sm font-semibold">✕ ยกเลิก</button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">ประเภทการอนุญาต</label>
                <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-700 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="ลากิจ">ลากิจ (ทำธุระส่วนตัว)</option>
                  <option value="ลาป่วย">ลาป่วย</option>
                  <option value="ลา รด.">ไปเรียน รด.</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">เหตุผลการขออนุญาต</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ระบุเหตุผลและสถานที่ที่จะไป..." className="w-full bg-slate-50 border border-slate-200 text-slate-700 p-3 rounded-xl h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
              </div>
              <button type="submit" disabled={isSubmitting} className={`w-full text-white py-3.5 rounded-xl font-bold shadow-md transition flex justify-center items-center mt-2 ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isSubmitting ? "กำลังบันทึกข้อมูล..." : "ยืนยันการส่งคำร้อง"}
              </button>
            </form>
          </div>
        ) : (
          <>
            <h4 className="text-sm font-bold text-slate-700 mb-3">ประวัติการขออนุญาต</h4>
            
            {myRequests.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-4 bg-white rounded-xl">ยังไม่มีประวัติการขออนุญาต</p>
            ) : (
              <div className="flex flex-col gap-3">
                {myRequests.map((req) => (
                  <div key={req.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                    <div className="flex flex-col w-2/3">
                      <p className="text-sm font-bold text-slate-800 truncate">{req.leaveType}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(req.createdAt)}</p>
                      <p className="text-xs text-slate-500 mt-1 truncate">{req.reason}</p>
                    </div>
                    <div>
                      {req.status === 'pending' && <span className="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-1 rounded-md font-bold">รออนุมัติ</span>}
                      {req.status === 'rejected' && <span className="bg-red-100 text-red-600 text-[10px] px-2 py-1 rounded-md font-bold">ไม่อนุมัติ</span>}
                      {req.status === 'approved' && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-md font-bold">อนุมัติแล้ว</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        
        <button 
          onClick={() => {
            setIsLoggedIn(false);
            setUsername('');
            setPassword('');
            setCurrentStudent(null);
            setMyRequests([]);
          }}
          className="w-full mt-8 text-slate-400 hover:text-red-500 text-sm font-medium py-2 transition"
        >
          ออกจากระบบ (Logout)
        </button>

      </div>
    </div>
  );
}