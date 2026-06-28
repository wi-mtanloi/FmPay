import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { 
  Users, 
  UserPlus, 
  UserCheck, 
  Sparkles,
  Home,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  joinFamilyGroup, 
  createNewFamilyGroup 
} from '../services/firebase';
import { MemberRole } from '../types';

interface SetupFamilyProps {
  user: User;
  onRefreshUserDoc: () => void;
}

export const SetupFamily: React.FC<SetupFamilyProps> = ({
  user,
  onRefreshUserDoc
}) => {
  const [familyCode, setFamilyCode] = useState('');
  const [newFamilyName, setNewFamilyName] = useState('');
  const [userRole, setUserRole] = useState<MemberRole>('Khác');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyCode.trim()) {
      setError('Vui lòng nhập mã gia đình.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await joinFamilyGroup(user.uid, familyCode.trim(), userRole);
      setSuccess('Đã kết nối và tham gia nhóm gia đình thành công!');
      onRefreshUserDoc();
      setTimeout(() => {
        setSuccess('');
        setFamilyCode('');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Không thể tham gia gia đình.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyName.trim()) {
      setError('Vui lòng nhập tên gia đình.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const newId = await createNewFamilyGroup(user.uid, newFamilyName.trim(), userRole);
      setSuccess(`Đã tạo nhóm gia đình thành công! Mã gia đình của bạn: ${newId}`);
      onRefreshUserDoc();
      setTimeout(() => {
        setSuccess('');
        setNewFamilyName('');
      }, 4000);
    } catch (err: any) {
      console.error('Error creating family:', err);
      setError(err.message || 'Lỗi khi tạo nhóm gia đình.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-4 px-2">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Banner header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-6 py-8 text-white text-center sm:text-left sm:flex sm:items-center sm:justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center justify-center sm:justify-start gap-2.5">
              <Users className="w-6 h-6 text-indigo-200 animate-bounce" /> Thiết lập tài khoản gia đình
            </h2>
            <p className="text-indigo-100 text-xs sm:text-sm font-medium">
              Chào {user.displayName || 'bạn'}! Bạn chưa tham gia nhóm gia đình nào. Hãy bắt đầu kết nối để đồng bộ thu chi thời gian thực nhé.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex justify-center shrink-0">
            <div className="p-3.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <Home className="w-8 h-8 text-indigo-100" />
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-xs sm:text-sm rounded-2xl border border-red-100 font-medium flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-4 bg-emerald-50 text-emerald-800 text-xs sm:text-sm rounded-2xl border border-emerald-100 font-medium flex items-start gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Role selection - placed high for flow visibility */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div className="space-y-0.5">
              <span className="font-bold flex items-center gap-1.5 text-slate-800">
                <Sparkles className="w-4 h-4 text-amber-500 animate-spin" /> Bước 1: Chọn vai trò của bạn
              </span>
              <p className="text-[11px] text-slate-500">Giúp phân biệt đóng góp ngân sách hoặc thành viên ghi chép.</p>
            </div>
            <select
              value={userRole}
              disabled={loading}
              onChange={(e) => setUserRole(e.target.value as MemberRole)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 shadow-sm min-w-[150px]"
            >
              <option value="Chồng">👨‍💼 Chồng</option>
              <option value="Vợ">👩‍💼 Vợ</option>
              <option value="Khác">👥 Khác / Con cái</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
            {/* Column 1: Join Existing */}
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 rounded-xl">
                    <UserPlus className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Tham gia gia đình sẵn có</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Nếu vợ/chồng hoặc người nhà của bạn đã tạo một nhóm gia đình rồi, hãy lấy mã gia đình (bắt đầu bằng <strong className="text-indigo-600">FAM-</strong>) nhập vào ô bên dưới.
                </p>
              </div>

              <form onSubmit={handleJoinFamily} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">Mã nhóm gia đình</label>
                  <input
                    type="text"
                    value={familyCode}
                    disabled={loading}
                    onChange={(e) => setFamilyCode(e.target.value)}
                    placeholder="Ví dụ: FAM-123456"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm uppercase font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {loading ? 'Đang kết nối...' : 'Kết nối ngay'}
                </button>
              </form>
            </div>

            {/* Column 2: Create New */}
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 rounded-xl">
                    <UserCheck className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Tạo mới một nhóm gia đình</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Nếu bạn là người đầu tiên tham gia ứng dụng này, hãy đặt tên và khởi tạo một nhóm gia đình. Sau đó gửi mã số gia đình cho các thành viên khác.
                </p>
              </div>

              <form onSubmit={handleCreateFamily} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">Tên nhóm gia đình của bạn</label>
                  <input
                    type="text"
                    value={newFamilyName}
                    disabled={loading}
                    onChange={(e) => setNewFamilyName(e.target.value)}
                    placeholder="Tên gia đình (VD: Tổ ấm nhỏ)"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 shadow-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {loading ? 'Đang tạo...' : 'Tạo mới gia đình'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
