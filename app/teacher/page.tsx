"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from '../lib/firebase'; 
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

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

// สร้าง Interface สำหรับเก็บข้อมูลครูที่ Login สำเร็จ
interface TeacherData {
  teacherId: string;
  teacherName: string;
}

export default function TeacherPage() {
  // ==========================================
  // States: ระบบ Login & ข้อมูลผู้ใช้
  // ==========================================
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // เก็บข้อมูลครูหลังจากดึงจาก Database สำเร็จ
  const [currentTeacher, setCurrentTeacher] = useState<TeacherData | null>(null);

  // ==========================================
  // States: ข้อมูลคำร้อง
  // ==========================================
  const [todayRequests, setTodayRequests] = useState<LeaveRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);

  const [reviewData, setReviewData] = useState<LeaveRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const now = new Date();
  const formattedDate = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  const formattedTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  // ----------------------------------------------------
  // ระบบ Login (ดึงข้อมูลจาก Firestore Collection: Teachers)
  // ----------------------------------------------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === '' || password.trim() === '') {
      setError('กรุณากรอกรหัสประจำตัวครูและรหัสผ่านให้ครบถ้วน');
      return;
    }

    setIsLoggingIn(true);
    setError('');

    try {
      // ค้นหาข้อมูลครูจาก Document ID (รหัสประจำตัวครู)
      const teacherDocRef = doc(db, "Teachers", username.trim());
      const teacherDoc = await getDoc(teacherDocRef);

      if (teacherDoc.exists()) {
        const data = teacherDoc.data();
        
        // ตรวจสอบรหัสผ่าน
        if (data.password === password) {
          // Login สำเร็จ บันทึกข้อมูลครูลง State
          setCurrentTeacher({
            teacherId: username,
            teacherName: data.teacherName || 'ไม่ระบุชื่อ'
          });
          setIsLoggedIn(true);
        } else {
          setError('รหัสผ่านไม่ถูกต้อง');
        }
      } else {
        setError('ไม่พบรหัสประจำตัวครูนี้ในระบบ');
      }
    } catch (err) {
      console.error("Login Error:", err);
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setCurrentTeacher(null);
    setTodayRequests([]);
    setPendingRequests([]);
  };

  // ----------------------------------------------------
  // ดึงข้อมูลจาก Firebase แบบ Real-time
  // ----------------------------------------------------
  useEffect(() => {
    if (!isLoggedIn) return;

    const q = query(collection(db, "LeaveRequests"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allReqs: LeaveRequest[] = [];
      snapshot.forEach((doc) => {
        allReqs.push({ id: doc.id, ...doc.data() } as LeaveRequest);
      });

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todaysData = allReqs.filter((req) => {
        const reqDate = req.createdAt?.toDate ? req.createdAt.toDate() : new Date(0);
        return reqDate >= startOfDay;
      });

      setTodayRequests(todaysData);
      setPendingRequests(allReqs.filter(req => req.status === "pending"));
    });

    return () => unsubscribe();
  }, [isLoggedIn]);

  // ----------------------------------------------------
  // คำนวณสถิติ & กราฟ
  // ----------------------------------------------------
  const stats = {
    total: todayRequests.length,
    pending: todayRequests.filter(r => r.status === 'pending').length,
    approved: todayRequests.filter(r => r.status === 'approved').length,
    rejected: todayRequests.filter(r => r.status === 'rejected').length,
  };

  const chartData = {
    labels: ['อนุมัติแล้ว', 'รอพิจารณา', 'ไม่อนุมัติ'],
    datasets: [
      {
        data: [stats.approved, stats.pending, stats.rejected],
        backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
        borderColor: ['#ffffff', '#ffffff', '#ffffff'],
        borderWidth: 2,
        cutout: '70%',
      },
    ],
  };

  const chartOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return ` ${context.label}: ${context.raw} คน`;
          }
        }
      }
    },
    maintainAspectRatio: false,
  };

  // ----------------------------------------------------
  // ฟังก์ชันจัดการการอนุมัติ (ใช้ชื่อครูจริง)
  // ----------------------------------------------------
  const handleOpenReview = (request: LeaveRequest, action: 'approved' | 'rejected') => {
    setReviewData(request);
    setReviewAction(action);
  };

  const confirmAction = async () => {
    if (!reviewData || !reviewAction || !currentTeacher) return;
    setIsSubmitting(true);
    try {
      const requestRef = doc(db, "LeaveRequests", reviewData.id);
      
      // บันทึกชื่อจริงของครูลงไปในฐานข้อมูล
      await updateDoc(requestRef, {
        status: reviewAction,
        approvedBy: reviewAction === 'approved' ? currentTeacher.teacherName : null,
        rejectedBy: reviewAction === 'rejected' ? currentTeacher.teacherName : null,
        actionAt: new Date()
      });
      
      setReviewData(null);
      setReviewAction(null);
    } catch (error) {
      console.error("เกิดข้อผิดพลาด:", error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // UI - หน้า Login
  // ==========================================
  if (!isLoggedIn) {
    return (
       <div className="min-h-screen bg-slate-100 flex items-center justify-center p-5 font-sans">
        <div className="max-w-sm w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
          
          {/* สถานะกำลังโหลดตอน Login */}
          {isLoggingIn && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
              <p className="text-blue-600 font-bold text-sm">กำลังตรวจสอบข้อมูล...</p>
            </div>
          )}

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">👩‍🏫</div>
            <h2 className="text-2xl font-bold text-slate-800">ระบบครูผู้สอน</h2>
            <p className="text-slate-500 text-sm">MR E-Pass Approve</p>
          </div>
          
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">รหัสประจำตัวครู</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="เช่น T001" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">รหัสผ่าน</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่าน" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500" />
            </div>
            
            {error && <p className="text-red-500 text-sm font-medium text-center bg-red-50 p-2 rounded-lg">{error}</p>}
            
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
      </div>
    );
  }

  // ==========================================
  // UI - หน้า Dashboard ครู
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-100 pb-10 relative font-sans">
      <div className="bg-white pt-14 pb-4 px-5 border-b border-slate-200 sticky top-0 z-20 shadow-sm flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">แดชบอร์ดครู</h1>
          <p className="text-slate-500 text-sm">ผู้ใช้งาน: {currentTeacher?.teacherName}</p>
        </div>
        <button onClick={handleLogout} className="text-sm font-medium text-red-500 hover:text-red-700 transition">ออกจากระบบ</button>
      </div>

      <div className="p-5 max-w-md mx-auto">
        
        {/* กราฟและสถิติ */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6 animate-fade-in">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
            สถิติการขออนุญาตวันนี้
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">รวม {stats.total} รายการ</span>
          </h2>
          
          {stats.total === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">ยังไม่มีคำร้องในวันนี้</div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="w-32 h-32 relative">
                <Doughnut data={chartData} options={chartOptions} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-slate-800">{stats.total}</span>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span><span className="text-sm text-slate-600">อนุมัติ</span></div>
                  <span className="font-bold text-slate-800">{stats.approved}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-500"></span><span className="text-sm text-slate-600">รอพิจารณา</span></div>
                  <span className="font-bold text-slate-800">{stats.pending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className="text-sm text-slate-600">ไม่อนุมัติ</span></div>
                  <span className="font-bold text-slate-800">{stats.rejected}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* รายการคำร้องที่รอการอนุมัติ */}
        <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          รายการรออนุมัติ 
          {pendingRequests.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-sm">
              {pendingRequests.length}
            </span>
          )}
        </h2>

        {pendingRequests.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-slate-200">
            <p className="text-slate-400 font-medium">ไม่มีคำร้องที่รอการอนุมัติในขณะนี้</p>
          </div>
        ) : (
          pendingRequests.map((req) => (
            <div key={req.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-4 animate-fade-in">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{req.studentName}</h3>
                  <p className="text-sm text-slate-500">{req.classroom} • รหัส: {req.studentId}</p>
                </div>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-lg mb-4 border border-slate-100">
                <p className="text-sm text-slate-700"><span className="font-semibold text-slate-500">ประเภท:</span> {req.leaveType}</p>
                <p className="text-sm text-slate-700 mt-1"><span className="font-semibold text-slate-500">เหตุผล:</span> {req.reason}</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => handleOpenReview(req, 'approved')} className="flex-1 bg-green-500 text-white py-2 rounded-lg font-bold text-sm hover:bg-green-600 transition shadow-sm">✓ อนุมัติ</button>
                <button onClick={() => handleOpenReview(req, 'rejected')} className="flex-1 bg-red-50 text-red-500 py-2 rounded-lg font-bold text-sm hover:bg-red-100 transition">✕ ไม่อนุมัติ</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal ยืนยันการทำรายการ */}
      {reviewData && reviewAction && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
            <div className={`p-4 text-center text-white ${reviewAction === 'approved' ? 'bg-green-500' : 'bg-red-500'}`}>
              <h2 className="text-lg font-bold">{reviewAction === 'approved' ? 'ตรวจสอบก่อนอนุมัติ' : 'ตรวจสอบก่อนไม่อนุมัติ'}</h2>
            </div>
            <div className="p-6 relative">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-inner space-y-2.5">
                <div className="flex justify-between border-b border-slate-200 pb-2"><span className="text-slate-500 text-sm font-medium">ชื่อ-สกุล</span><span className="text-slate-800 text-sm font-bold">{reviewData.studentName}</span></div>
                <div className="flex justify-between border-b border-slate-200 pb-2"><span className="text-slate-500 text-sm font-medium">ชั้นเรียน</span><span className="text-slate-800 text-sm font-bold">{reviewData.classroom}</span></div>
                <div className="flex justify-between border-b border-slate-200 pb-2"><span className="text-slate-500 text-sm font-medium">รหัสนักเรียน</span><span className="text-slate-800 text-sm font-bold">{reviewData.studentId}</span></div>
                <div className="flex justify-between border-b border-slate-200 pb-2"><span className="text-slate-500 text-sm font-medium">ประเภทการลา</span><span className="text-slate-800 text-sm font-bold text-blue-600">{reviewData.leaveType}</span></div>
                <div className="flex flex-col pb-2"><span className="text-slate-500 text-sm font-medium mb-1">เหตุผล</span><span className="text-slate-800 text-sm font-semibold">{reviewData.reason}</span></div>
                
                <div className="flex justify-between pt-1"><span className="text-slate-500 text-sm font-medium">ผลการพิจารณา</span><span className={`px-2 py-0.5 rounded text-xs font-bold text-white shadow-sm ${reviewAction === 'approved' ? 'bg-green-500' : 'bg-red-500'}`}>{reviewAction === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ'}</span></div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-500 text-sm font-medium">ผู้พิจารณา</span>
                  {/* นำชื่อครูจากที่ดึงมาได้จาก DB มาแสดง */}
                  <span className="text-slate-800 text-sm font-bold">{currentTeacher?.teacherName}</span>
                </div>
                <div className="flex flex-col pt-2 text-center mt-2 border-t border-slate-200 border-dashed">
                  <span className="text-slate-400 text-[10px] uppercase font-medium tracking-wider mb-1">เวลาที่ทำรายการ</span>
                  <span className="text-slate-700 text-sm font-bold bg-slate-100 py-1 rounded">{formattedDate} • {formattedTime} น.</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 flex gap-2 border-t border-slate-100">
              <button onClick={() => { setReviewData(null); setReviewAction(null); }} disabled={isSubmitting} className="flex-1 py-3 text-slate-500 font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-50">ย้อนกลับ</button>
              <button onClick={confirmAction} disabled={isSubmitting} className={`flex-[2] py-3 text-white font-bold rounded-xl shadow-md transition disabled:opacity-70 ${reviewAction === 'approved' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
                {isSubmitting ? 'กำลังส่งข้อมูล...' : reviewAction === 'approved' ? 'ยืนยันและส่ง QR Code' : 'ยืนยันการไม่อนุมัติ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}