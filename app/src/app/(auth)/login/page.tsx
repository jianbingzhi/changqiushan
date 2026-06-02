export const metadata = {
  title: "登录 · 长秋山森林公园智慧景区管理后台",
};

export default function LoginPage() {
  return (
    <div className="w-[400px] bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-8">
      <div className="mb-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[#2D5A27] mx-auto mb-4 flex items-center justify-center">
          <span className="text-white text-xl font-bold">山</span>
        </div>
        <h1 className="text-xl font-bold text-[#1F2937]">长秋山森林公园智慧景区</h1>
        <p className="text-[13px] text-[#6B7280] mt-1">管理后台</p>
      </div>
      {/* B01 完整登录表单在阶段 1 实现（GoTrue 认证就位后） */}
      <p className="text-center text-[13px] text-[#6B7280]">登录功能将在阶段 1 实现</p>
    </div>
  );
}
