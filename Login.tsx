import { useState, useEffect } from 'react';
import { signIn, signUp } from './auth';
import { supabase } from './supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showSignUpEmail, setShowSignUpEmail] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Load saved email from localStorage
  useEffect(() => {
    const savedEmail = localStorage.getItem('saved_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  // 認証URLをクリックした後の処理を確認
  useEffect(() => {
    const checkAuthCallback = async () => {
      // URLハッシュから認証情報を取得
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');

      if (accessToken && type === 'signup') {
        // 認証URLをクリックした場合
        console.log('🔍 checkAuthCallback: Auth URL clicked, type =', type);
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session) {
          console.log('✅ checkAuthCallback: Session found, showing password setup');
          setShowSetPassword(true);
          setEmail(session.user.email || '');
          // URLハッシュをクリア
          window.history.replaceState(null, '', window.location.pathname);
        }
      } else {
        // 通常のセッションチェック
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user && !session.user.user_metadata?.has_password) {
          // パスワードが設定されていない場合は、パスワード設定画面を表示
          setShowSetPassword(true);
          setEmail(session.user.email || '');
        }
      }
    };
    checkAuthCallback();
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

  // 新規登録：メールアドレスを送信
  const handleSendSignUpEmail = async () => {
    if (!email) {
      setError('メールアドレスを入力してください');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('🔍 handleSendSignUpEmail: Sending signup email to', email);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin,
        },
      });

      if (otpError) {
        console.error('❌ handleSendSignUpEmail: Error:', otpError);
        setError(otpError.message || 'メールの送信に失敗しました');
      } else {
        console.log('✅ handleSendSignUpEmail: Email sent successfully');
        setSuccessMessage(`${email} に認証メールを送信しました。メール内のリンクをクリックして認証を完了してください。`);
        setShowSignUpEmail(false);
      }
    } catch (err: any) {
      console.error('❌ handleSendSignUpEmail: Exception:', err);
      setError(err.message || 'メールの送信に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // パスワードを設定
  const handleSetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('🔍 handleSetPassword: Setting password...');
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error('❌ handleSetPassword: Error:', updateError);
        setError(updateError.message || 'パスワードの設定に失敗しました');
      } else {
        console.log('✅ handleSetPassword: Password set successfully');
        setSuccessMessage('パスワードを設定しました。ログインできます。');
        setShowSetPassword(false);
        setNewPassword('');
        setConfirmPassword('');
        // パスワード設定後は自動的にログインされる
      }
    } catch (err: any) {
      console.error('❌ handleSetPassword: Exception:', err);
      setError(err.message || 'パスワードの設定に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 認証メールを再送信
  const handleResendSignUpEmail = async () => {
    if (!email) {
      setError('メールアドレスを入力してください');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('🔍 handleResendSignUpEmail: Resending signup email to', email);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin,
        },
      });

      if (otpError) {
        console.error('❌ handleResendSignUpEmail: Error:', otpError);
        setError(otpError.message || 'メールの再送に失敗しました');
      } else {
        console.log('✅ handleResendSignUpEmail: Email resent successfully');
        setSuccessMessage(`${email} に認証メールを再送信しました。`);
      }
    } catch (err: any) {
      console.error('❌ handleResendSignUpEmail: Exception:', err);
      setError(err.message || 'メールの再送に失敗しました');
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

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6 text-sm">
            {successMessage}
          </div>
        )}

        {showSetPassword ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl mb-6 text-sm">
              <p className="font-semibold mb-2">パスワードを設定してください</p>
              <p>メールアドレスの認証が完了しました。ログインに使用するパスワードを設定してください。</p>
            </div>

            <input
              type="password"
              placeholder="パスワード（6文字以上）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              className="login-input w-full"
            />

            <input
              type="password"
              placeholder="パスワード（確認）"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              className="login-input w-full"
            />

            <button
              onClick={handleSetPassword}
              disabled={isLoading || !newPassword || newPassword.length < 6 || newPassword !== confirmPassword}
              className="modern-button w-full"
            >
              {isLoading ? '設定中...' : 'パスワードを設定'}
            </button>
          </div>
        ) : showSignUpEmail ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl mb-6 text-sm">
              <p className="font-semibold mb-2">新規登録</p>
              <p>メールアドレスを入力してください。認証メールを送信します。</p>
            </div>

            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="login-input w-full"
            />

            <button
              onClick={handleSendSignUpEmail}
              disabled={isLoading || !email}
              className="modern-button w-full"
            >
              {isLoading ? '送信中...' : '認証メールを送信'}
            </button>

            <button
              onClick={() => {
                setShowSignUpEmail(false);
                setError('');
                setSuccessMessage('');
              }}
              disabled={isLoading}
              className="w-full bg-white bg-opacity-60 backdrop-filter backdrop-blur-lg border border-white border-opacity-40 text-gray-700 py-3 rounded-2xl font-semibold hover:bg-opacity-80 disabled:opacity-50 transition-all duration-300"
            >
              戻る
            </button>
          </div>
        ) : successMessage && !showSignUpEmail ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl mb-6 text-sm">
              <p className="font-semibold mb-2">認証メールを送信しました</p>
              <p className="mb-2">{email} に認証メールを送信しました。メール内のリンクをクリックして認証を完了してください。</p>
              <p className="text-xs text-blue-600 mt-2">
                ※ メールが届かない場合は、迷惑メールフォルダも確認してください。
              </p>
            </div>

            <button
              onClick={handleResendSignUpEmail}
              disabled={isLoading}
              className="w-full bg-white bg-opacity-60 backdrop-filter backdrop-blur-lg border border-white border-opacity-40 text-gray-700 py-3 rounded-2xl font-semibold hover:bg-opacity-80 disabled:opacity-50 transition-all duration-300"
            >
              {isLoading ? '送信中...' : '認証メールを再送信'}
            </button>

            <button
              onClick={() => {
                setSuccessMessage('');
                setError('');
                setShowSignUpEmail(true);
              }}
              disabled={isLoading}
              className="w-full bg-white bg-opacity-60 backdrop-filter backdrop-blur-lg border border-white border-opacity-40 text-gray-700 py-3 rounded-2xl font-semibold hover:bg-opacity-80 disabled:opacity-50 transition-all duration-300"
            >
              メールアドレスを変更
            </button>
          </div>
        ) : (
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
                console.log('🔍 新規登録はこちら: Button clicked, showing signup email form');
                setShowSignUpEmail(true);
                setError('');
                setSuccessMessage('');
              }}
              disabled={isLoading}
              className="w-full bg-white bg-opacity-60 backdrop-filter backdrop-blur-lg border border-white border-opacity-40 text-gray-700 py-3 rounded-2xl font-semibold hover:bg-opacity-80 disabled:opacity-50 transition-all duration-300"
            >
              新規登録はこちら
            </button>
          )}
          </div>
        )}
      </div>
    </div>
  );
}
