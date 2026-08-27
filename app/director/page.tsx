"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from '../lib/firebase'; 
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

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

interface ScanLog {
  id: string;
  studentName: string;
  studentId: string;
  scannedAt: any;
  scannedBy: string;
}

export default function DirectorPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [allScanLogs, setAllScanLogs] = useState<ScanLog[]>([]); // ✅ เพิ่ม State สำหรับเก็บประวัติการสแกน
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // กำหนดค่าเริ่มต้นเป็นเดือนปัจจุบัน (YYYY-MM)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === '' || password.trim() === '') {
      setLoginError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }
    setIsLoggingIn(true);
    setLoginError('');
    setTimeout(() => {
      if (username === 'director' && password === '1234') {
        setIsLoggedIn(true);
      } else {
        setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
      setIsLoggingIn(false);
    }, 800);
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    setIsLoadingData(true);
    
    // 1. ดึงข้อมูลคำร้องขออนุญาตทั้งหมด
    const qReq = query(collection(db, "LeaveRequests"), orderBy("createdAt", "desc"));
    const unsubReq = onSnapshot(qReq, (snapshot) => {
      const data: LeaveRequest[] = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as LeaveRequest));
      setAllRequests(data);
    });

    // 2. ดึงข้อมูลประวัติการสแกนของ รปภ. ทั้งหมด
    const qScan = query(collection(db, "ScanLogs"), orderBy("scannedAt", "desc"));
    const unsubScan = onSnapshot(qScan, (snapshot) => {
      const data: ScanLog[] = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as ScanLog));
      setAllScanLogs(data);
      setIsLoadingData(false); // ปิดสถานะโหลดเมื่อดึงข้อมูลเสร็จ
    });

    return () => {
      unsubReq();
      unsubScan();
    };
  }, [isLoggedIn]);

  // ==========================================
  // ฟังก์ชันคำนวณข้อมูลสถิติ (กรองตามเดือน)
  // ==========================================
  
  // กรองคำร้องตามเดือนที่เลือก
  const filteredRequests = allRequests.filter(req => {
    if (!req.createdAt?.toDate) return false;
    const reqMonth = req.createdAt.toDate().toISOString().slice(0, 7);
    return reqMonth === selectedMonth;
  });

  // กรองประวัติการสแกนตามเดือนที่เลือก
  const filteredScanLogs = allScanLogs.filter(log => {
    if (!log.scannedAt?.toDate) return false;
    const logMonth = log.scannedAt.toDate().toISOString().slice(0, 7);
    return logMonth === selectedMonth;
  });

  // แยกเพศ
  const getGender = (name: string) => {
    if (!name) return 'ไม่ระบุ';
    if (name.startsWith('เด็กชาย') || name.startsWith('นาย')) return 'ชาย';
    if (name.startsWith('เด็กหญิง') || name.startsWith('นางสาว')) return 'หญิง';
    return 'ไม่ระบุ';
  };

  // แยกระดับชั้น
  const getGradeLevel = (classroom: string) => {
    if (!classroom) return 'อื่นๆ';
    const match = classroom.match(/ม\.?\s*([1-6])/);
    if (match) return `ม.${match[1]}`;
    return 'อื่นๆ';
  };

  const maleCount = filteredRequests.filter(r => getGender(r.studentName) === 'ชาย').length;
  const femaleCount = filteredRequests.filter(r => getGender(r.studentName) === 'หญิง').length;

  const gradeCounts = { 'ม.1': 0, 'ม.2': 0, 'ม.3': 0, 'ม.4': 0, 'ม.5': 0, 'ม.6': 0 };
  filteredRequests.forEach(req => {
    const level = getGradeLevel(req.classroom) as keyof typeof gradeCounts;
    if (gradeCounts[level] !== undefined) gradeCounts[level]++;
  });

  const stats = {
    total: filteredRequests.length,
    approved: filteredRequests.filter(r => r.status === 'approved').length,
    rejected: filteredRequests.filter(r => r.status === 'rejected').length,
    pending: filteredRequests.filter(r => r.status === 'pending').length,
  };

  // ==========================================
  // ข้อมูลสำหรับกราฟ
  // ==========================================
  
  const genderChartData = {
    labels: ['นักเรียนชาย', 'นักเรียนหญิง'],
    datasets: [{
      label: 'จำนวนการขออนุญาต (ครั้ง)',
      data: [maleCount, femaleCount],
      backgroundColor: ['#3b82f6', '#ec4899'],
      borderRadius: 8,
    }],
  };

  const gradeChartData = {
    labels: ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'],
    datasets: [{
      label: 'จำนวนการขออนุญาต (ครั้ง)',
      data: [gradeCounts['ม.1'], gradeCounts['ม.2'], gradeCounts['ม.3'], gradeCounts['ม.4'], gradeCounts['ม.5'], gradeCounts['ม.6']],
      backgroundColor: '#8b5cf6',
      borderRadius: 8,
    }],
  };

  // ✅ คำนวณกราฟประวัติการสแกนออกรายวัน
  const yearInt = parseInt(selectedMonth.split('-')[0]);
  const monthInt = parseInt(selectedMonth.split('-')[1]);
  const daysInMonth = new Date(yearInt, monthInt, 0).getDate(); // หาจำนวนวันในเดือนนั้น
  
  const daysLabels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
  const dailyScanCounts = new Array(daysInMonth).fill(0);

  filteredScanLogs.forEach(log => {
    if (log.scannedAt?.toDate) {
      const day = log.scannedAt.toDate().getDate();
      dailyScanCounts[day - 1]++; // นับจำนวนสแกนในแต่ละวัน
    }
  });

  const scanChartData = {
    labels: daysLabels,
    datasets: [{
      label: 'จำนวนนักเรียนที่สแกนออก (คน)',
      data: dailyScanCounts,
      backgroundColor: '#10b981', // สีเขียว
      borderRadius: 4,
    }],
  };

  // ==========================================
  // ฟังก์ชันดาวน์โหลด PDF
  // ==========================================
  const handleDownloadPDF = async () => {
    const element = document.getElementById('pdf-report-container');
    if (!element) return;
    
    const btn = document.getElementById('download-btn');
    if (btn) btn.innerHTML = '⏳ กำลังสร้าง PDF...';

    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`รายงานสถิติ_${selectedMonth}.pdf`);
    } catch (err) {
      console.error("PDF generation error", err);
      alert("เกิดข้อผิดพลาดในการสร้าง PDF");
    } finally {
      if (btn) btn.innerHTML = '📥 ดาวน์โหลด PDF';
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-5 font-sans relative">
        <div className="max-w-sm w-full bg-white p-8 rounded-2xl shadow-sm border-t-8 border-purple-600 z-10">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">📊</div>
            <h2 className="text-2xl font-bold text-slate-800">ระบบผู้บริหาร</h2>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username " className="w-full bg-slate-50 border p-3.5 rounded-xl outline-none" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password " className="w-full bg-slate-50 border p-3.5 rounded-xl outline-none" />
            {loginError && <p className="text-red-500 text-sm font-medium text-center">{loginError}</p>}
            <button type="submit" disabled={isLoggingIn} className="w-full bg-purple-600 text-white font-bold py-3.5 rounded-xl mt-2">{isLoggingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>


                <a 
                href="/" 
                className="w-full bg-slate-700 text-slate-300 hover:text-white font-bold py-3.5 rounded-xl hover:bg-slate-600 transition flex items-center justify-center gap-1.5 text-sm shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                กลับหน้าหลัก
              </a>




          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      {/* ส่วนควบคุม (ไม่รวมใน PDF) */}
      <div className="bg-purple-800 text-white p-5 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-20 shadow-md">
        <div>
          <h1 className="text-xl font-bold">MRW E-Pass Executive</h1>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 rounded-lg text-slate-800 font-bold outline-none flex-1 md:flex-none"
          />
          <button id="download-btn" onClick={handleDownloadPDF} className="bg-white text-purple-700 font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-slate-100 transition whitespace-nowrap">
            📥 ดาวน์โหลด PDF
          </button>
          <button onClick={() => setIsLoggedIn(false)} className="bg-purple-900 text-purple-100 px-3 py-2 rounded-lg text-sm font-bold">ออก</button>
        </div>
      </div>

      {/* ส่วนรายงานที่จะถูกสร้างเป็น PDF */}
      <div id="pdf-report-container" className="max-w-5xl mx-auto mt-6 bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200">
        <div className="text-center mb-8 border-b pb-4">
          <h2 className="text-2xl font-bold text-slate-800">รายงานสถิติการขออนุญาตออกนอกสถานศึกษา</h2>
          <p className="text-slate-500 mt-2">ประจำเดือน: <span className="font-bold text-purple-600">{selectedMonth}</span></p>
        </div>

        {isLoadingData ? (
          <div className="text-center py-10 text-purple-600 font-bold">กำลังประมวลผลข้อมูล...</div>
        ) : (
          <>
            {/* กล่องสถิติสรุป */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-50 p-4 rounded-xl border-l-4 border-l-purple-500 text-center">
                <p className="text-xs text-slate-500 font-bold">ยื่นขอทั้งหมด</p>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-xl border-l-4 border-l-green-500 text-center">
                <p className="text-xs text-green-600 font-bold">อนุมัติแล้ว</p>
                <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border-l-4 border-l-amber-500 text-center">
                <p className="text-xs text-amber-600 font-bold">รอพิจารณา</p>
                <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-xl border-l-4 border-l-red-500 text-center">
                <p className="text-xs text-red-600 font-bold">ไม่อนุมัติ</p>
                <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
              </div>
            </div>

            {/* พื้นที่กราฟแบ่งครึ่งซ้ายขวา */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* กราฟเปรียบเทียบชายหญิง */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-4 text-center">สัดส่วนการขออนุญาตตามเพศ (ครั้ง)</h3>
                <div className="h-64 w-full flex justify-center">
                  <Bar 
                    data={genderChartData} 
                    options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} 
                  />
                </div>
              </div>

              {/* กราฟเปรียบเทียบระดับชั้น */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-4 text-center">สถิติการขออนุญาตแยกตามระดับชั้น (ครั้ง)</h3>
                <div className="h-64 w-full flex justify-center">
                  <Bar 
                    data={gradeChartData} 
                    options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} 
                  />
                </div>
              </div>
            </div>

            {/* ✅ พื้นที่กราฟการสแกนออกรายวัน (เข้ามาแทนที่ตาราง) */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-2 text-center">สถิติการสแกนออกนอกสถานศึกษาโดยเจ้าหน้าที่รักษาความปลอดภัย</h3>
              <p className="text-xs text-slate-500 text-center mb-6">แสดงยอดรวมจำนวนนักเรียนที่ออกนอกโรงเรียนในแต่ละวันของเดือน</p>
              
              <div className="h-72 w-full flex justify-center">
                <Bar 
                  data={scanChartData} 
                  options={{ 
                    maintainAspectRatio: false, 
                    plugins: { legend: { display: false } },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 } // ให้แกน Y นับทีละ 1
                      }
                    }
                  }} 
                />
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}