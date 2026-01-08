import { useState, useEffect } from 'react';
import { signIn, signUp } from './auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

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
        setError(authError.message);
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
        // 新規登録成功時は自動的にログインされる
      }
    } catch (err: any) {
      console.error('❌ handleSignUp: Signup exception:', err);
      setError(err.message || '新規登録に失敗しました。');
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
      </div>
    </div>
  );
}
