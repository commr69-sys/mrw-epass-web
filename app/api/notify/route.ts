import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message } = body;

    // ดึงค่ากุญแจและ ID ปลายทางจากไฟล์ .env.local
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const targetId = process.env.LINE_TARGET_ID;

    if (!token || !targetId) {
      return NextResponse.json({ error: 'ไม่พบข้อมูล LINE Token หรือ Target ID' }, { status: 500 });
    }

    // ยิง API ไปที่เซิร์ฟเวอร์ของ LINE Messaging API (Endpoint สำหรับ Push Message)
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      // โครงสร้างข้อมูลที่ต้องส่งไปตามคู่มือของ LINE
      body: JSON.stringify({
        to: targetId,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      })
    });

    if (!response.ok) {
      // ดึงข้อความ Error จาก LINE มาดูว่าผิดพลาดตรงไหน (เช่น ID ผิด หรือ Token หมดอายุ)
      const errorData = await response.json();
      console.error("LINE API Error:", errorData);
      throw new Error('ส่งแจ้งเตือน LINE Official ไม่สำเร็จ');
    }

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการส่งแจ้งเตือน' }, { status: 500 });
  }
}