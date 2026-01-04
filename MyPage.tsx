import React, { useState, useEffect } from 'react';
import { UserProfile } from './types';
import { supabase } from './supabase';
import { signOut } from './auth';

interface MyPageProps {
  profile: UserProfile;
  onProfileUpdate: (profile: UserProfile) => void;
  totalRecordCount: number;
}

const MyPage: React.FC<MyPageProps> = ({ profile, onProfileUpdate, totalRecordCount }) => {
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [personality, setPersonality] = useState<UserProfile['personality']>(profile.personality);
  const [customInstruction, setCustomInstruction] = useState<string>(profile.customInstruction || '');
  const [profilePicture, setProfilePicture] = useState<string | undefined>(profile.profilePicture);
  const [isLoading, setIsLoading] = useState(false);
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        setCurrentEmail(data.user.email || '');
      }
    });
  }, []);

  // Update state when profile changes
  useEffect(() => {
    setPersonality(profile.personality);
    setCustomInstruction(profile.customInstruction || '');
  }, [profile]);

  const handleSendEmailVerificationCode = async () => {
    if (!newEmail || newEmail === currentEmail) {
      setMessage({ type: 'error', text: '現在のメールアドレスとは異なるアドレスを入力してください' });
      return;
    }
    setIsLoading(true);
    setMessage(null);

    try {
      // SupabaseのupdateUserは新しいメールアドレスに確認メールを送信する
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      setEmailCodeSent(true);
      setMessage({ 
        type: 'success', 
        text: `${newEmail} に確認コードを送信しました。メールを確認してコードを入力してください。` 
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '確認コードの送信に失敗しました' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmailCode = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      setMessage({ type: 'error', text: '確認コードを正しく入力してください' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      // Supabaseでは、確認リンクをクリックする必要があるため、
      // ここではユーザーに確認メールのリンクをクリックしてもらうよう案内する
      // 実際のコード検証はSupabaseが自動で行う
      const { data: { user: updatedUser } } = await supabase.auth.getUser();
      if (updatedUser?.email === newEmail) {
        setMessage({ type: 'success', text: 'メールアドレスが正常に更新されました' });
        setCurrentEmail(newEmail);
        setNewEmail('');
        setVerificationCode('');
        setEmailCodeSent(false);
      } else {
        setMessage({ 
          type: 'error', 
          text: 'メールアドレスの確認が完了していません。メール内のリンクをクリックして確認してください。' 
        });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'メールアドレスの確認に失敗しました' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!currentPassword) {
      setMessage({ type: 'error', text: '現在のパスワードを入力してください' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setMessage({ type: 'error', text: '新しいパスワードは6文字以上である必要があります' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '新しいパスワードが一致しません' });
      return;
    }
    if (currentPassword === newPassword) {
      setMessage({ type: 'error', text: '現在のパスワードと新しいパスワードは異なる必要があります' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      // 現在のパスワードで再認証
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('現在のパスワードが正しくありません');
      }

      // パスワードを更新
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      
      setMessage({ type: 'success', text: 'パスワードを更新しました' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'パスワードの更新に失敗しました' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfilePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: '画像サイズは5MB以下である必要があります' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setProfilePicture(base64);
      const updatedProfile = { ...profile, profilePicture: base64 };
      onProfileUpdate(updatedProfile);
      setMessage({ type: 'success', text: 'プロフィール画像を更新しました' });
    };
    reader.readAsDataURL(file);
  };

  const handlePersonalityChange = (newPersonality: UserProfile['personality']) => {
    setPersonality(newPersonality);
    const updatedProfile: UserProfile = { 
      ...profile, 
      personality: newPersonality,
      customInstruction: newPersonality === 'custom' ? (profile.customInstruction || '') : undefined,
    };
    onProfileUpdate(updatedProfile);
    setMessage({ type: 'success', text: 'AIモードを更新しました' });
  };

  const handleCustomInstructionChange = (instruction: string) => {
    setCustomInstruction(instruction);
    const updatedProfile: UserProfile = { 
      ...profile, 
      personality: 'custom',
      customInstruction: instruction,
    };
    onProfileUpdate(updatedProfile);
  };

  const personalityOptions = [
    { value: 'supportive' as const, label: '優しい親友', emoji: '💝' },
    { value: 'strict' as const, label: '熱血コーチ', emoji: '🔥' },
    { value: 'philosophical' as const, label: '静かな賢者', emoji: '🧘' },
    { value: 'custom' as const, label: 'カスタム（指示出し）', emoji: '✨' },
  ];

  return (
    <div className="max-w-2xl mx-auto mt-6 space-y-6">
      <h2 className="large-friendly-text px-2 mb-4">マイページ</h2>

      {message && (
        <div
          className={`glass-card p-4 ${
            message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}
        >
          <p className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
            {message.text}
          </p>
        </div>
      )}

      {/* Statistics */}
      <div className="glass-card-strong p-6">
        <h3 className="font-semibold text-gray-800 mb-4">記録統計</h3>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-pink-600">{totalRecordCount}</div>
            <div className="text-sm text-gray-600 mt-1">記録日数</div>
          </div>
        </div>
      </div>

      {/* Profile Picture */}
      <div className="glass-card-strong p-6">
        <h3 className="font-semibold text-gray-800 mb-4">プロフィール画像</h3>
        <div className="flex items-center gap-6">
          <div className="relative">
            {profilePicture ? (
              <img
                src={profilePicture}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-200 to-blue-200 flex items-center justify-center text-4xl">
                👤
              </div>
            )}
          </div>
          <div>
            <label className="modern-button cursor-pointer inline-block">
              <input
                type="file"
                accept="image/*"
                onChange={handleProfilePictureUpload}
                className="hidden"
              />
              画像を選択
            </label>
          </div>
        </div>
      </div>

      {/* Email Update */}
      <div className="glass-card-strong p-6">
        <h3 className="font-semibold text-gray-800 mb-4">メールアドレス</h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-600 mb-2">現在のメールアドレス: {currentEmail}</p>
          </div>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="login-input w-full"
            placeholder="新しいメールアドレス"
            disabled={isLoading || emailCodeSent}
          />
          {!emailCodeSent ? (
            <button
              onClick={handleSendEmailVerificationCode}
              disabled={isLoading || !newEmail || newEmail === currentEmail}
              className="modern-button w-full"
            >
              {isLoading ? '送信中...' : '確認コードを送信'}
            </button>
          ) : (
            <>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="login-input w-full"
                placeholder="確認コード（メールに送信されたリンクをクリックしてください）"
                disabled={isLoading}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleVerifyEmailCode}
                  disabled={isLoading || !verificationCode}
                  className="modern-button flex-1"
                >
                  {isLoading ? '確認中...' : '確認'}
                </button>
                <button
                  onClick={() => {
                    setEmailCodeSent(false);
                    setVerificationCode('');
                    setNewEmail('');
                  }}
                  className="w-24 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition"
                >
                  キャンセル
                </button>
              </div>
              <p className="text-xs text-gray-500">
                ※ メールアドレス変更には、新しいメールアドレスに送信された確認リンクをクリックする必要があります。
              </p>
            </>
          )}
        </div>
      </div>

      {/* Password Update */}
      <div className="glass-card-strong p-6">
        <h3 className="font-semibold text-gray-800 mb-4">パスワード変更</h3>
        <div className="space-y-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="login-input w-full"
            placeholder="現在のパスワード"
            disabled={isLoading}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="login-input w-full"
            placeholder="新しいパスワード（6文字以上）"
            disabled={isLoading}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="login-input w-full"
            placeholder="新しいパスワード（確認用）"
            disabled={isLoading}
          />
          <button
            onClick={handlePasswordUpdate}
            disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
            className="modern-button w-full"
          >
            {isLoading ? '更新中...' : 'パスワードを更新'}
          </button>
        </div>
      </div>

      {/* AI Mode Selection */}
      <div className="glass-card-strong p-6">
        <h3 className="font-semibold text-gray-800 mb-4">AIモード</h3>
        <p className="soft-text text-sm mb-4">AIの応答スタイルを選択してください</p>
        <div className="space-y-3">
          {personalityOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handlePersonalityChange(option.value)}
              className={`
                w-full p-4 rounded-xl transition-all text-left
                ${personality === option.value
                  ? 'bg-gradient-to-br from-pink-200 to-blue-200 border-2 border-pink-400'
                  : 'bg-white bg-opacity-60 border border-gray-200 hover:bg-opacity-80'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{option.emoji}</span>
                <span className="font-medium text-gray-800">{option.label}</span>
                {personality === option.value && (
                  <span className="ml-auto text-pink-600">✓</span>
                )}
              </div>
            </button>
          ))}
        </div>
        
        {/* Custom Instruction Input */}
        {personality === 'custom' && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              カスタム指示
            </label>
            <textarea
              value={customInstruction}
              onChange={(e) => handleCustomInstructionChange(e.target.value)}
              className="modern-textarea w-full h-32"
              placeholder="例：英語で返答してください、短めに答えてください、ユーモアを交えて返答してください など"
            />
            <p className="text-xs text-gray-500 mt-2">
              AIにどのように応答してほしいかを自由に指示できます
            </p>
          </div>
        )}
      </div>

      {/* Logout Button */}
      <div className="glass-card-strong p-6">
        <button
          onClick={async () => {
            if (confirm('ログアウトしますか？')) {
              await signOut();
            }
          }}
          className="w-full bg-red-500 bg-opacity-80 hover:bg-opacity-100 text-white py-3 rounded-xl font-semibold transition-all duration-300"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
};

export default MyPage;

