"use client";

import React, { useState } from 'react';
import Papa from 'papaparse';
import { doc, writeBatch } from "firebase/firestore";
import { db } from '../lib/firebase';

export default function AdminPage() {
  // ==========================================
  // States: ระบบ Login
  // ==========================================
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // ==========================================
  // States: ระบบนำเข้าข้อมูล
  // ==========================================
  const [importType, setImportType] = useState<'students' | 'teachers'>('students');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');

  // ----------------------------------------------------
  // ฟังก์ชัน Login
  // ----------------------------------------------------
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === '1234') {
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setMessage('');
    setCsvFile(null);
  };

  // ----------------------------------------------------
  // ฟังก์ชันจับการเปลี่ยนไฟล์
  // ----------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
      setMessage('');
    }
  };

  // ----------------------------------------------------
  // ฟังก์ชันอ่านไฟล์ CSV และอัปโหลดขึ้น Firebase
  // ----------------------------------------------------
  const handleUpload = () => {
    if (!csvFile) {
      setMessage('กรุณาเลือกไฟล์ CSV ก่อนอัปโหลด');
      return;
    }

    setIsUploading(true);
    setMessage('กำลังประมวลผลไฟล์...');

    Papa.parse(csvFile, {
      header: true, 
      skipEmptyLines: true, 
      complete: async (results) => {
        const data = results.data as any[];
        
        if (data.length === 0) {
          setMessage('ไม่พบข้อมูลในไฟล์ CSV');
          setIsUploading(false);
          return;
        }

        try {
          const batch = writeBatch(db);
          const collectionName = importType === 'students' ? 'Students' : 'Teachers';
          
          data.forEach((row) => {
            const docId = importType === 'students' ? row.studentId : row.teacherId;
            
            if (docId) {
              const docRef = doc(db, collectionName, String(docId));
              batch.set(docRef, row); 
            }
          });

          await batch.commit();

          setMessage(`✅ อัปโหลดข้อมูล ${importType === 'students' ? 'นักเรียน' : 'ครู'} จำนวน ${data.length} รายการสำเร็จ!`);
          setCsvFile(null);
          const fileInput = document.getElementById('csvInput') as HTMLInputElement;
          if (fileInput) fileInput.value = '';

        } catch (error) {
          console.error("เกิดข้อผิดพลาดในการอัปโหลด:", error);
          setMessage('❌ เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
        } finally {
          setIsUploading(false);
        }
      },
      error: (error) => {
        console.error("PapaParse Error:", error);
        setMessage('❌ เกิดข้อผิดพลาดในการอ่านไฟล์ CSV');
        setIsUploading(false);
      }
    });
  };

  // ==========================================
  // UI - หน้า Login
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-5 font-sans">
        <div className="max-w-sm w-full bg-white p-8 rounded-2xl shadow-sm border-t-8 border-orange-500 overflow-hidden">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">⚙️</div>
            <h2 className="text-2xl font-bold text-slate-800">ผู้จัดการระบบ (Admin)</h2>
            <p className="text-slate-500 text-sm mt-1">ตั้งค่าและจัดการฐานข้อมูล</p>
          </div>
          
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">ชื่อผู้ใช้ (admin)</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">รหัสผ่าน (1234)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            
            {loginError && <p className="text-red-500 text-sm font-medium text-center bg-red-50 p-2 rounded-lg">{loginError}</p>}
            
            <button type="submit" className="w-full bg-orange-600 text-white font-bold py-3.5 rounded-xl hover:bg-orange-700 shadow-md transition mt-2">
              เข้าสู่ระบบ
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // UI - หน้าจัดการระบบ (แสดงหลัง Login)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-100 p-5 md:p-10 font-sans relative">
      <div className="max-w-2xl mx-auto">
        
        {/* ปุ่มออกจากระบบ */}
        <div className="flex justify-end mb-4">
          <button onClick={handleLogout} className="text-red-500 hover:text-red-700 font-semibold text-sm transition bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
            ออกจากระบบ
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-200 animate-fade-in">
          
          <div className="bg-slate-800 text-white p-6 md:p-8 text-center">
            <div className="w-16 h-16 bg-slate-700 text-3xl flex items-center justify-center rounded-full mx-auto mb-4">⚙️</div>
            <h1 className="text-2xl font-bold">จัดการฐานข้อมูล (Admin)</h1>
            <p className="text-slate-400 mt-2 text-sm">นำเข้าข้อมูลนักเรียนและครูผ่านไฟล์ CSV</p>
          </div>

          <div className="p-6 md:p-8">
            {/* เลือกประเภทการนำเข้า */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">1. เลือกประเภทข้อมูลที่ต้องการนำเข้า</label>
              <div className="flex gap-4">
                <label className={`flex-1 border-2 p-4 rounded-xl cursor-pointer transition text-center ${importType === 'students' ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                  <input type="radio" name="importType" className="hidden" checked={importType === 'students'} onChange={() => setImportType('students')} />
                  👨‍🎓 ข้อมูลนักเรียน
                </label>
                <label className={`flex-1 border-2 p-4 rounded-xl cursor-pointer transition text-center ${importType === 'teachers' ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                  <input type="radio" name="importType" className="hidden" checked={importType === 'teachers'} onChange={() => setImportType('teachers')} />
                  👩‍🏫 ข้อมูลครูผู้สอน
                </label>
              </div>
            </div>

            {/* อัปโหลดไฟล์ */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">2. อัปโหลดไฟล์ CSV</label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition">
                <input 
                  id="csvInput"
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileChange}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 cursor-pointer"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                * ต้องมีหัวคอลัมน์: {importType === 'students' ? 'studentId, studentName, classroom, password' : 'teacherId, teacherName, password'}
              </p>
            </div>

            {/* แสดงข้อความแจ้งเตือน */}
            {message && (
              <div className={`p-4 rounded-xl mb-6 text-sm font-semibold text-center ${message.includes('✅') ? 'bg-green-100 text-green-700' : message.includes('❌') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                {message}
              </div>
            )}

            {/* ปุ่มยืนยัน */}
            <button 
              onClick={handleUpload}
              disabled={isUploading || !csvFile}
              className={`w-full py-4 rounded-xl font-bold text-white shadow-md transition flex items-center justify-center gap-2
              ${isUploading || !csvFile ? 'bg-slate-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'}`}
            >
              {isUploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  กำลังอัปโหลดข้อมูล...
                </>
              ) : (
                'อัปโหลดข้อมูลเข้าระบบ'
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}