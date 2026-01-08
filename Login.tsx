import { useState, useEffect } from 'react';
import { signIn, signUp } from './auth';
import { supabase } from './supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showVerificationCode, setShowVerificationCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  // Load saved email from localStorage
  useEffect(() => {
    const savedEmail = localStorage.getItem('saved_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  const handleSignIn = async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data, error: authError } = await signIn(email, password);
      if (authError) {
        console.error('❌ ログインエラー:', authError);
        // アカウントが確認されていない場合のエラーメッセージを改善
        if (authError.message.includes('Email not confirmed') || authError.message.includes('email_not_confirmed')) {
          setError('メールアドレスが確認されていません。メールに送信された確認コードを入力してください。');
          setShowVerificationCode(true);
        } else {
          setError(authError.message);
        }
      } else {
        console.log('✅ ログイン成功:', data);
        // Save email if rememberEmail is checked
        if (rememberEmail) {
          localStorage.setItem('saved_email', email);
        } else {
          localStorage.removeItem('saved_email');
        }
      }
    } catch (err: any) {
      console.error('❌ ログイン例外:', err);
      setError(err.message || 'ログインに失敗しました。環境変数を確認してください。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    console.log('🔍 handleSignUp: Starting signup...', { email, passwordLength: password.length });
    setIsLoading(true);
    setError('');
    try {
      const { data, error: authError } = await signUp(email, password);
      if (authError) {
        console.error('❌ handleSignUp: Signup error:', authError);
        setError(authError.message);
      } else {
        console.log('✅ handleSignUp: Signup successful:', data);
        // セッションがnullの場合はメール確認が必要
        if (!data.session) {
          console.log('🔍 handleSignUp: Session is null, showing verification code input');
          setShowVerificationCode(true);
          setError('');
        }
        // セッションがある場合は自動的にログインされる
      }
    } catch (err: any) {
      console.error('❌ handleSignUp: Signup exception:', err);
      setError(err.message || '新規登録に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      setError('確認コードを正しく入力してください（6桁）');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode,
        type: 'signup',
      });

      if (verifyError) {
        console.error('❌ handleVerifyCode: Verification error:', verifyError);
        setError(verifyError.message || '確認コードが正しくありません');
      } else {
        console.log('✅ handleVerifyCode: Verification successful:', data);
        setShowVerificationCode(false);
        setVerificationCode('');
        setError('');
        // 確認成功後は自動的にログインされる
      }
    } catch (err: any) {
      console.error('❌ handleVerifyCode: Verification exception:', err);
      setError(err.message || '確認コードの検証に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    setError('');

    try {
      console.log('🔍 handleResendCode: Resending verification code to', email);
      // 確認コードを再送信（signupの場合は再度signUpを呼び出す）
      const { data, error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (resendError) {
        console.error('❌ handleResendCode: Resend error:', resendError);
        // resendが失敗した場合は、再度signUpを試みる
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) {
          setError(signUpError.message || '確認コードの再送に失敗しました');
        } else {
          setError('');
          // 成功メッセージを表示（エラーがない場合は既に表示されている）
        }
      } else {
        console.log('✅ handleResendCode: Code resent successfully');
        setError('');
      }
    } catch (err: any) {
      console.error('❌ handleResendCode: Resend exception:', err);
      setError(err.message || '確認コードの再送に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="gradient-bg min-h-screen flex items-center justify-center p-4">
      <div className="login-glass p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="ai-avatar mx-auto mb-4">
            <span>✨</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            dAIary
          </h1>
          <p className="soft-text text-sm">あなたの成長を一番近くで見守る</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        {showVerificationCode ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl mb-6 text-sm">
              <p className="font-semibold mb-2">確認コードを送信しました</p>
              <p className="mb-2">{email} に確認コードを送信しました。メールを確認して6桁のコードを入力してください。</p>
              <p className="text-xs text-blue-600 mt-2">
                ※ メールが届かない場合は、迷惑メールフォルダも確認してください。
              </p>
            </div>

            <input
              type="text"
              placeholder="確認コード（6桁）"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={isLoading}
              className="login-input w-full text-center text-2xl tracking-widest"
              maxLength={6}
            />

            <button
              onClick={handleVerifyCode}
              disabled={isLoading || verificationCode.length !== 6}
              className="modern-button w-full"
            >
              {isLoading ? '確認中...' : '確認コードを送信'}
            </button>

            <button
              onClick={handleResendCode}
              disabled={isLoading}
              className="w-full bg-white bg-opacity-60 backdrop-filter backdrop-blur-lg border border-white border-opacity-40 text-gray-700 py-3 rounded-2xl font-semibold hover:bg-opacity-80 disabled:opacity-50 transition-all duration-300"
            >
              {isLoading ? '送信中...' : '確認コードを再送信'}
            </button>

            <button
              onClick={() => {
                setShowVerificationCode(false);
                setVerificationCode('');
                setError('');
              }}
              disabled={isLoading}
              className="w-full bg-white bg-opacity-60 backdrop-filter backdrop-blur-lg border border-white border-opacity-40 text-gray-700 py-3 rounded-2xl font-semibold hover:bg-opacity-80 disabled:opacity-50 transition-all duration-300"
            >
              戻る
            </button>
          </div>
        ) : (
          <div className="space-y-4">
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="login-input w-full"
          />

          <input
            type="password"
            placeholder="パスワード（6文字以上）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="login-input w-full"
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(e) => setRememberEmail(e.target.checked)}
              disabled={isLoading}
              className="w-4 h-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
            />
            <span className="text-sm text-gray-700">メールアドレスを保存</span>
          </label>

          <button
            onClick={handleSignIn}
            disabled={isLoading || !email || !password}
            className="modern-button w-full"
          >
            {isLoading ? 'ログイン中...' : 'ログイン'}
          </button>

          {!showSignUp && (
            <button
              onClick={() => {
                console.log('🔍 新規登録はこちら: Button clicked, setting showSignUp to true');
                setShowSignUp(true);
              }}
              disabled={isLoading || !email || !password}
              className="w-full bg-white bg-opacity-60 backdrop-filter backdrop-blur-lg border border-white border-opacity-40 text-gray-700 py-3 rounded-2xl font-semibold hover:bg-opacity-80 disabled:opacity-50 transition-all duration-300"
            >
              新規登録はこちら
            </button>
          )}

          {showSignUp && (
            <button
              onClick={() => {
                console.log('🔍 新規登録ボタン: Button clicked, calling handleSignUp');
                handleSignUp();
              }}
              disabled={isLoading || !email || !password}
              className="w-full bg-white bg-opacity-60 backdrop-filter backdrop-blur-lg border border-white border-opacity-40 text-gray-700 py-3 rounded-2xl font-semibold hover:bg-opacity-80 disabled:opacity-50 transition-all duration-300"
            >
              {isLoading ? '作成中...' : '新規登録'}
            </button>
          )}
          </div>
        )}
      </div>
    </div>
  );
}
