import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-2xl w-full bg-white rounded-[2rem] shadow-xl overflow-hidden border-t-[10px] border-blue-500 p-8 md:p-12 relative">
        
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-100 rounded-full opacity-50 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-sky-100 rounded-full opacity-50 blur-2xl"></div>

        {/* Header Section */}
        <div className="text-center mb-10 relative z-10">
          {/* Logo Placeholder - ให้นำไฟล์โลโก้โรงเรียนมาใส่ที่โฟลเดอร์ public แล้วเปลี่ยน src เป็น "/logo.png" */}
          <div className="w-28 h-28 mx-auto mb-4 bg-blue-50 rounded-full border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
            {/* หากมีรูปภาพโลโก้จริงให้เปิดใช้โค้ดบรรทัดล่างนี้ และลบ div ที่เป็นตัวย่อออก */}
            { <img src="/logo.png" alt="โลโก้โรงเรียนเม็งรายมหาราชวิทยาคม" className="w-full h-full object-cover" />}
            
          </div>
          
          <h1 className="text-4xl font-extrabold text-slate-800 mb-2 tracking-tight">
            MR <span className="text-blue-600">E-Pass</span>
          </h1>
          <h2 className="text-lg md:text-xl text-slate-500 font-medium bg-blue-50 inline-block px-4 py-1.5 rounded-full">
            ระบบการขออนุญาตออกนอกบริเวณโรงเรียน
          </h2>
          <p className="text-slate-400 text-sm mt-3">โรงเรียนเม็งรายมหาราชวิทยาคม</p>
        </div>

        {/* Menu Buttons Section */}
        <div className="flex flex-col gap-4 relative z-10">
          
          {/* 1. Student Button */}
          <Link href="/student" className="group flex items-center p-5 bg-white border-2 border-slate-100 rounded-2xl hover:border-blue-400 hover:bg-blue-50 hover:shadow-lg transition-all duration-300 ease-in-out cursor-pointer">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-inner">
              🎒
            </div>
            <div className="ml-5 text-left flex-1">
              <h3 className="text-xl font-bold text-slate-800 group-hover:text-blue-700 transition-colors">ระบบขออนุญาตสำหรับนักเรียน</h3>
              <p className="text-slate-500 text-sm mt-1">เขียนใบลา, ลากิจ, ลาป่วย, ดิจิทัลพาส</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-200 group-hover:text-blue-700 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </div>
          </Link>

          {/* 2. Teacher Button */}
          <Link href="/teacher" className="group flex items-center p-5 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-lg transition-all duration-300 ease-in-out cursor-pointer">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-inner">
              👩‍🏫
            </div>
            <div className="ml-5 text-left flex-1">
              <h3 className="text-xl font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">ระบบการอนุมัติสำหรับครู</h3>
              <p className="text-slate-500 text-sm mt-1">ตรวจสอบคำร้องและอนุมัติใบลา</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-200 group-hover:text-indigo-700 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </div>
          </Link>

          {/* 3. Guard Button */}
          <Link href="/guard" className="group flex items-center p-5 bg-white border-2 border-slate-100 rounded-2xl hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-lg transition-all duration-300 ease-in-out cursor-pointer">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-inner">
              🛡️
            </div>
            <div className="ml-5 text-left flex-1">
              <h3 className="text-xl font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">ระบบตรวจสอบสำหรับเจ้าหน้าที่</h3>
              <p className="text-slate-500 text-sm mt-1">สแกน QR Code ตรวจสอบการเข้า-ออก</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-200 group-hover:text-emerald-700 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </div>
          </Link>

          {/* 4. Admin Button */}
          <Link href="/admin" className="group flex items-center p-5 bg-white border-2 border-slate-100 rounded-2xl hover:border-orange-400 hover:bg-orange-50 hover:shadow-lg transition-all duration-300 ease-in-out cursor-pointer">
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-inner">
              ⚙️
            </div>
            <div className="ml-5 text-left flex-1">
              <h3 className="text-xl font-bold text-slate-800 group-hover:text-orange-700 transition-colors">ผู้จัดการระบบ (Admin)</h3>
              <p className="text-slate-500 text-sm mt-1">จัดการฐานข้อมูลและตั้งค่าระบบ</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-orange-200 group-hover:text-orange-700 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </div>
          </Link>

        </div>
      </div>
    </div>
  );
}