import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { 
  LogOut, 
  Users, 
  Copy, 
  Check, 
  UserPlus, 
  UserCheck, 
  HelpCircle,
  TrendingUp,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { 
  UserDoc, 
  joinFamilyGroup, 
  createNewFamilyGroup, 
  updateUserRole 
} from '../services/firebase';
import { MemberRole } from '../types';

interface HeaderProps {
  user: User | null;
  userDoc: UserDoc | null;
  onLogin: () => void;
  onLogout: () => void;
  onRefreshUserDoc: () => void;
  showFamilyModal: boolean;
  setShowFamilyModal: (show: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  userDoc,
  onLogin,
  onLogout,
  onRefreshUserDoc,
  showFamilyModal,
  setShowFamilyModal
}) => {
  const [familyCode, setFamilyCode] = useState('');
  const [newFamilyName, setNewFamilyName] = useState('');
  const [userRole, setUserRole] = useState<MemberRole>('Khác');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const copyFamilyId = () => {
    if (userDoc?.familyId) {
      navigator.clipboard.writeText(userDoc.familyId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!familyCode.trim()) {
      setError('Vui lòng nhập mã gia đình.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await joinFamilyGroup(user.uid, familyCode.trim(), userRole);
      setSuccess('Đã tham gia nhóm gia đình thành công!');
      onRefreshUserDoc();
      setTimeout(() => {
        setShowFamilyModal(false);
        setSuccess('');
        setFamilyCode('');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Không thể tham gia gia đình.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newFamilyName.trim()) {
      setError('Vui lòng nhập tên gia đình.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const newId = await createNewFamilyGroup(user.uid, newFamilyName.trim(), userRole);
      setSuccess(`Đã tạo nhóm gia đình thành công! Mã: ${newId}`);
      onRefreshUserDoc();
      setTimeout(() => {
        setShowFamilyModal(false);
        setSuccess('');
        setNewFamilyName('');
      }, 2000);
    } catch (err: any) {
      console.error('Error creating family:', err);
      setError(err.message || 'Lỗi khi tạo nhóm gia đình.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as MemberRole;
    if (user && userDoc) {
      try {
        await updateUserRole(user.uid, newRole);
        onRefreshUserDoc();
      } catch (err) {
        console.error('Error updating role:', err);
      }
    }
  };

  return (
    <header id="app-header" className="bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              FamilyPay <span className="text-xs font-semibold px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">• Đang đồng bộ hóa</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">Quản lý Tài chính Gia đình Thông minh</p>
          </div>
        </div>

        {/* User Info / Auth */}
        <div className="flex items-center gap-3 ml-auto">
          {user ? (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Family Connection Dashboard widget */}
              {userDoc && (
                <div className="hidden sm:flex items-center gap-2 bg-slate-50 hover:bg-slate-100 transition px-3 py-1.5 rounded-xl border border-slate-100 text-xs text-slate-700">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-semibold text-slate-800">{userDoc.familyId}</span>
                  <button 
                    onClick={copyFamilyId} 
                    className="p-1 hover:text-indigo-600 transition" 
                    title="Sao chép Mã Gia Đình"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-indigo-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-slate-300">|</span>
                  <button 
                    onClick={() => {
                      setUserRole(userDoc.role);
                      setShowFamilyModal(true);
                    }} 
                    className="hover:text-indigo-600 font-medium flex items-center gap-0.5"
                  >
                    Đổi Nhóm
                  </button>
                </div>
              )}

              {/* Profile Image & Role Selection */}
              <div className="flex items-center gap-2.5 bg-white p-1 rounded-full pr-3 border border-slate-200 shadow-sm">
                <img 
                  src={user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.email}`} 
                  alt={user.displayName || 'Avatar'} 
                  className="w-8 h-8 rounded-full border-2 border-white shadow-sm object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="text-left">
                  <div className="text-xs font-semibold text-slate-800 max-w-[120px] truncate">
                    {user.displayName || user.email}
                  </div>
                  {userDoc && (
                    <div className="flex items-center">
                      <select
                        value={userDoc.role}
                        onChange={handleRoleChange}
                        className="text-[10px] text-slate-500 font-medium bg-transparent border-none outline-none cursor-pointer focus:ring-0 p-0 pr-4"
                        style={{ backgroundPosition: 'right center' }}
                      >
                        <option value="Chồng">Chồng</option>
                        <option value="Vợ">Vợ</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Logout Button */}
              <button 
                onClick={onLogout}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                title="Đăng xuất"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="gsi-material-button text-xs font-semibold px-4 py-2 border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 flex items-center gap-2 transition"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              Đăng nhập với Google
            </button>
          )}
        </div>
      </div>

      {/* Join/Create Family Modal */}
      {showFamilyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-5 text-white shrink-0">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5" /> Kết nối Gia đình
              </h3>
              <p className="text-indigo-100 text-xs mt-1">Đồng bộ dữ liệu thời gian thực với các thành viên trong nhà.</p>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 font-medium">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-indigo-50 text-indigo-800 text-xs rounded-xl border border-indigo-100 font-medium">
                  {success}
                </div>
              )}

              {/* Join Existing */}
              <form onSubmit={handleJoinFamily} className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1">
                  <UserPlus className="w-4 h-4 text-indigo-600" /> Nhập mã gia đình hiện có
                </h4>
                <p className="text-[11px] text-slate-500">Hỏi vợ/chồng của bạn mã gia đình (bắt đầu bằng FAM-) và dán vào đây.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={familyCode}
                    onChange={(e) => setFamilyCode(e.target.value)}
                    placeholder="Ví dụ: FAM-XXXXXX"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm uppercase font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl text-xs transition flex items-center gap-1 shadow-sm"
                  >
                    Tham gia
                  </button>
                </div>
              </form>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-xs font-semibold">HOẶC</span>
                <div className="flex-grow border-t border-slate-100"></div>
              </div>

              {/* Create New */}
              <form onSubmit={handleCreateFamily} className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1">
                  <UserCheck className="w-4 h-4 text-indigo-600" /> Tạo một nhóm gia đình mới
                </h4>
                <p className="text-[11px] text-slate-500">Khởi tạo một gia đình mới và nhận mã để chia sẻ cho các thành viên khác.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFamilyName}
                    onChange={(e) => setNewFamilyName(e.target.value)}
                    placeholder="Tên gia đình (VD: Tổ ấm nhỏ)"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl text-xs transition flex items-center gap-1 shadow-sm"
                  >
                    Tạo mới
                  </button>
                </div>
              </form>

              {/* Role setting */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium flex items-center gap-1 text-slate-700">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Bạn đóng vai trò là:
                </span>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as MemberRole)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                >
                  <option value="Chồng">Chồng</option>
                  <option value="Vợ">Vợ</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowFamilyModal(false);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-slate-500 hover:text-slate-800 font-medium text-xs px-3 py-1.5 hover:bg-slate-100 rounded-lg transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
