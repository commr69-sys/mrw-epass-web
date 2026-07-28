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
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  
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
  // ฟังก์ชัน Login
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
      const studentDocRef = doc(db, "Students", username.trim());
      const studentDoc = await getDoc(studentDocRef);

      if (studentDoc.exists()) {
        const data = studentDoc.data();
        if (data.password === password) {
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
  // ฟังก์ชัน Logout
  // ----------------------------------------------------
  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setCurrentStudent(null);
    setMyRequests([]);
    setShowForm(false);
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
  // ฟังก์ชันส่งคำร้อง
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
        studentName: currentStudent.studentName,
        studentId: currentStudent.studentId,                
        classroom: currentStudent.classroom,     
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
  // Helper Functions & Date Checking
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

  const isToday = (timestamp: any) => {
    if (!timestamp || !timestamp.toDate) return false;
    const reqDate = timestamp.toDate();
    const today = new Date();
    return reqDate.getDate() === today.getDate() &&
      reqDate.getMonth() === today.getMonth() &&
      reqDate.getFullYear() === today.getFullYear();
  };

  const totalRequests = myRequests.length;
  const approvedCount = myRequests.filter(req => req.status === 'approved').length;
  const rejectedCount = myRequests.filter(req => req.status === 'rejected').length;
  
  const latestApprovedToday = myRequests.find(req => req.status === 'approved' && isToday(req.createdAt));

  // ==========================================
  // UI - หน้า Login
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center p-5 font-sans">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm flex flex-col gap-4 border-t-8 border-blue-600 relative overflow-hidden">
          
          {isLoggingIn && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
              <p className="text-blue-600 font-bold text-sm">กำลังตรวจสอบข้อมูล...</p>
            </div>
          )}

          <div className="text-center mb-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-2 shadow-inner">🎒</div>
            <h2 className="text-2xl font-bold text-slate-800">ระบบนักเรียน</h2>
            <p className="text-slate-500 text-sm">MR E-Pass Application</p>
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
          
          {/* ✅ จัดกลุ่มปุ่มให้อยู่คู่กันแบบ Grid */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <a 
              href="/" 
              className="w-full bg-slate-100 text-slate-600 hover:text-slate-800 font-bold py-3.5 rounded-xl hover:bg-slate-200 transition flex items-center justify-center gap-1.5 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              กลับหน้าหลัก
            </a>
            <button type="submit" disabled={isLoggingIn} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 shadow-md transition disabled:bg-slate-400 text-sm">
              เข้าสู่ระบบ
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ==========================================
  // UI - หน้าหลักนักเรียน
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-100 pb-10 font-sans relative">
      
      {/* Header พร้อมปุ่มควบคุมมุมขวาบน */}
      <div className="bg-blue-600 text-white pt-10 pb-12 px-5 rounded-b-3xl shadow-md relative">
        
        <div className="absolute top-5 right-5 flex gap-2 z-20">
          {/* 🔴 ปุ่มกลับหน้าหลัก (แสดงเฉพาะตอนอยู่หน้าฟอร์มเขียนคำร้อง) */}
          {showForm && (
            <button 
              onClick={() => setShowForm(false)}
              className="text-blue-100 hover:text-white text-xs font-semibold bg-white/10 hover:bg-white/20 py-2 px-3.5 rounded-xl transition backdrop-blur-sm flex items-center gap-1.5 border border-white/20 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              หน้าหลัก
            </button>
          )}

          {/* 🔴 ปุ่มออกจากระบบ */}
          <button 
            onClick={handleLogout}
            className="text-blue-100 hover:text-white text-xs font-semibold bg-white/10 hover:bg-white/20 py-2 px-3.5 rounded-xl transition backdrop-blur-sm flex items-center gap-1.5 border border-white/20 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            ออกจากระบบ
          </button>
        </div>

        <div className="flex justify-between items-center pr-28 relative z-10">
          <div>
            <h1 className="text-xl font-bold">MRW E-Pass</h1>
            <p className="text-blue-100 text-sm mt-1">{currentStudent?.studentName} ({currentStudent?.classroom})</p>
            <p className="text-blue-200 text-xs">รหัส: {currentStudent?.studentId}</p>
          </div>
        </div>
      </div>

      <div className="p-5 -mt-6 relative z-10 max-w-lg mx-auto">
        
        {!showForm && latestApprovedToday && (
          <div className="bg-white rounded-3xl shadow-xl border-t-8 border-green-500 overflow-hidden mb-6 animate-fade-in">
            <div className="p-6 bg-slate-50 flex flex-col items-center justify-center text-center">
              <span className="inline-block bg-green-100 text-green-700 px-4 py-1 rounded-full text-xs font-bold mb-3 shadow-sm">
                อนุมัติวันนี้ (Active E-Pass)
              </span>
              <h2 className="text-xl font-bold text-slate-800">{latestApprovedToday.leaveType}</h2>
              <p className="text-slate-500 text-xs mt-1 mb-4">อนุมัติเมื่อ: {formatDate(latestApprovedToday.createdAt)}</p>
              
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                <QRCodeCanvas id={`qr-${latestApprovedToday.id}`} value={`MRW-PASS:${latestApprovedToday.id}`} size={160} level={"H"} />
              </div>
              
              <p className="text-xs text-slate-400 mt-4 font-medium px-4">
                แสดง QR Code นี้ให้เจ้าหน้าที่รักษาความปลอดภัย ณ ประตูทางออก
              </p>
              <button onClick={() => downloadQRCode(latestApprovedToday.id)} className="mt-3 text-sm text-blue-600 font-semibold hover:underline">
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
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h2 className="text-lg font-bold text-slate-800">เขียนใบขออนุญาต</h2>
              {/* 🔴 ปุ่มกลับหน้าหลักภายในฟอร์ม */}
              <button 
                onClick={() => setShowForm(false)} 
                type="button" 
                className="bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 text-xs font-bold py-1.5 px-3 rounded-lg transition flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                กลับหน้าหลัก
              </button>
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
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span>📋</span> ประวัติการขออนุญาต
              </h4>
              
              {myRequests.length === 0 ? (
                <p className="text-center text-slate-400 text-xs py-6">ยังไม่มีประวัติการขออนุญาต</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                        <th className="pb-2">วันที่ / เวลา</th>
                        <th className="pb-2">ประเภท</th>
                        <th className="pb-2">เหตุผล</th>
                        <th className="pb-2 text-right">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs">
                      {myRequests.map((req) => {
                        const isReqToday = isToday(req.createdAt);
                        return (
                          <tr key={req.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 pr-2 text-slate-500 whitespace-nowrap font-medium text-[11px]">
                              {formatDate(req.createdAt)}
                            </td>
                            <td className="py-3 px-1 font-semibold text-slate-800 whitespace-nowrap">
                              {req.leaveType}
                            </td>
                            <td className="py-3 px-1 text-slate-600 max-w-[120px] truncate">
                              {req.reason}
                            </td>
                            <td className="py-3 pl-2 text-right whitespace-nowrap">
                              {req.status === 'pending' && (
                                <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                  รออนุมัติ
                                </span>
                              )}
                              {req.status === 'rejected' && (
                                <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                  ไม่อนุมัติ
                                </span>
                              )}
                              {req.status === 'approved' && (
                                isReqToday ? (
                                  <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                    อนุมัติแล้ว
                                  </span>
                                ) : (
                                  <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-medium" title="หมดอายุ (สแกนได้เฉพาะวันที่ขออนุมัติ)">
                                    หมดอายุ
                                  </span>
                                )
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}