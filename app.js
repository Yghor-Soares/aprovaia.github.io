const appElement = document.getElementById('app');
const authScreen = document.getElementById('auth-screen');
const signInButton = document.getElementById('google-signin');
const demoButton = document.getElementById('demo-signin');
const authStatus = document.getElementById('auth-status');
const authError = document.getElementById('auth-error');
const setupHelp = document.getElementById('auth-config-help');
const apiBaseUrl = (window.APROVAIA_API_BASE_URL || '').trim().replace(/\/+$/, '');
let firebaseAuth = null;
let firebaseSdk = null;
let demoMode = false;
let firebaseReady = false;
let consentedUid = null;

function apiUrl(path) {
  return apiBaseUrl ? apiBaseUrl + path : path;
}

function isAdultConfirmed() {
  const key = 'aprovaia-adult-confirmed';
  const confirmed = localStorage.getItem(key) === 'true' || sessionStorage.getItem(key) === 'true';
  if (confirmed) localStorage.setItem(key, 'true');
  return confirmed;
}

function updateAccessButtons() {
  const confirmed = document.getElementById('adult-confirmation').checked;
  signInButton.disabled = !firebaseReady || !confirmed;
  demoButton.disabled = !confirmed;
}

function showAuthError(message) {
  authError.textContent = message;
  authError.hidden = !message;
}

function enterApp(user, isDemo) {
  demoMode = isDemo;
  authScreen.hidden = true;
  appElement.hidden = false;
  document.getElementById('user-name').textContent = user?.displayName || (isDemo ? 'Modo demonstração' : 'Estudante');
  document.getElementById('user-email').textContent = user?.email || (isDemo ? 'Conteúdo de exemplo' : 'Conta Google');
  const initials = (user?.displayName || 'LC').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  document.getElementById('user-avatar').textContent = initials;
  const signoutButton = document.getElementById('signout-button');
  signoutButton.hidden = false;
  signoutButton.title = user ? 'Sair da conta' : 'Voltar para o login';
  signoutButton.setAttribute('aria-label', signoutButton.title);
  document.getElementById('storage-notice').hidden = !user;
  document.getElementById('proof-count').textContent = user ? '0' : '3';
  document.getElementById('topic-count').textContent = user ? '0' : '12';
  document.getElementById('reading-count').textContent = user ? '0' : '6';
  document.getElementById('proof-trend').textContent = user ? 'Envie sua primeira prova' : 'Exemplo ilustrativo';
  document.getElementById('topic-trend').textContent = user ? 'Aparecerão após uma análise' : 'Exemplo ilustrativo';
  document.getElementById('reading-trend').textContent = user ? 'Salvamento ainda não disponível' : 'Exemplo ilustrativo';
  showAuthError('');
}

function showLogin(clearConsent = false) {
  demoMode = false;
  if (clearConsent) {
    localStorage.removeItem('aprovaia-adult-confirmed');
    sessionStorage.removeItem('aprovaia-adult-confirmed');
    document.getElementById('adult-confirmation').checked = false;
  }
  appElement.hidden = true;
  authScreen.hidden = false;
  document.getElementById('signout-button').hidden = true;
  updateAccessButtons();
}

async function registerAdultConsent(user) {
  const token = await user.getIdToken();
  const response = await fetch(apiUrl('/api/adult-consent'), {
    method:'POST',
    headers:{
      Authorization:`Bearer ${token}`,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({ accepted:true })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Não foi possível registrar a confirmação de idade.');
  await user.getIdToken(true);
}

async function loadFirebase() {
  const response = await fetch(apiUrl('/api/config'));
  if (!response.ok) throw new Error('Não foi possível carregar a configuração do servidor.');
  const config = await response.json();
  if (!config.firebaseConfigured) {
    authStatus.textContent = 'O login com Google ainda precisa da configuração do Firebase. Você pode explorar a demonstração.';
    setupHelp.hidden = false;
    return;
  }
  try {
    const [appSdk, authSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
    ]);
    firebaseSdk = { ...appSdk, ...authSdk };
    const firebaseApp = appSdk.initializeApp(config.firebase);
    firebaseAuth = authSdk.getAuth(firebaseApp);
    await authSdk.setPersistence(firebaseAuth, authSdk.browserLocalPersistence);
    authSdk.getRedirectResult(firebaseAuth).catch((error) => {
      console.error('Falha no retorno do login Google:', error.code || error.message);
      showAuthError('Não foi possível concluir o login Google. Confira as configurações e tente novamente.');
    });
    authSdk.onAuthStateChanged(firebaseAuth, (user) => {
      if (user && isAdultConfirmed()) {
        if (consentedUid === user.uid) {
          enterApp(user, false);
          return;
        }
        consentedUid = user.uid;
        authStatus.textContent = 'Registrando sua confirmação de idade…';
        registerAdultConsent(user).then(() => {
          enterApp(user, false);
        }).catch((error) => {
          consentedUid = null;
          console.error('Falha ao registrar confirmação de idade:', error.message);
          showLogin();
          showAuthError(error.message);
        });
      } else if (!demoMode) {
        showLogin();
      }
    }, (error) => {
      showAuthError('Não foi possível verificar sua sessão: ' + error.message);
    });
    firebaseReady = true;
    updateAccessButtons();
    authStatus.textContent = config.aiProvider === 'ollama' && config.providers?.local
      ? 'IA local gratuita configurada. As provas são analisadas no seu computador, sem cobrança de API.'
      : config.aiProvider === 'gemini' && config.providers?.gemini
        ? 'Gemini configurado. O Ollama local pode servir como contingência gratuita.'
      : config.providers?.gemini && config.providers?.openai
        ? 'Gemini configurado com OpenAI opcional como contingência.'
        : config.providers?.gemini
          ? 'Gemini configurado para gerar materiais com IA.'
          : config.providers?.openai
            ? 'OpenAI configurada para gerar materiais com IA.'
            : 'O Ollama local não está pronto. Inicie o Ollama e confirme que o modelo gemma4:e2b está instalado.';
    if (!config.aiConfigured) setupHelp.hidden = false;
  } catch (error) {
    console.error('Falha ao carregar Firebase Authentication:', error);
    authStatus.textContent = 'Não foi possível carregar o Firebase. Verifique a conexão e tente novamente.';
    setupHelp.hidden = false;
  }
}

async function signInWithGoogle() {
  showAuthError('');
  if (!document.getElementById('adult-confirmation').checked) {
    showAuthError('Confirme que você tem 18 anos ou mais para continuar.');
    return;
  }
  if (!firebaseAuth || !firebaseSdk) {
    showAuthError('O login ainda não está configurado. Confira os passos de configuração abaixo.');
    return;
  }
  localStorage.setItem('aprovaia-adult-confirmed', 'true');
  signInButton.disabled = true;
  try {
    const provider = new firebaseSdk.GoogleAuthProvider();
    if (window.matchMedia('(max-width: 760px)').matches) {
      await firebaseSdk.signInWithRedirect(firebaseAuth, provider);
    } else {
      await firebaseSdk.signInWithPopup(firebaseAuth, provider);
    }
  } catch (error) {
    console.error('Falha no login Google:', error.code || error.message);
    if (error.code === 'auth/popup-closed-by-user') return;
    if (error.code === 'auth/unauthorized-domain') {
      showAuthError('Este domínio ainda não está autorizado no Firebase. Adicione localhost em Authentication → Settings → Authorized domains.');
    } else {
      showAuthError('Não foi possível entrar com Google. Confira as configurações do provedor Firebase e tente novamente.');
    }
  } finally {
    updateAccessButtons();
  }
}

async function signOut() {
  if (firebaseAuth && firebaseSdk) await firebaseSdk.signOut(firebaseAuth);
  consentedUid = null;
  showLogin(true);
}

async function apiRequest(endpoint, options = {}) {
  if (!firebaseAuth?.currentUser) {
    throw new Error('Entre com o Google para usar as funções de inteligência artificial.');
  }
  const token = await firebaseAuth.currentUser.getIdToken();
  const response = await fetch(apiUrl(endpoint), {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      await signOut();
    }
    throw new Error(result.error || 'Não foi possível concluir sua solicitação.');
  }
  return result;
}

window.approvaia = {
  get demoMode() { return demoMode; },
  analyzeProof(formData, signal) {
    return apiRequest('/api/analyze', { method:'POST', body:formData, signal });
  },
  generateStudyGuide(payload, signal) {
    return apiRequest('/api/study-guide', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify(payload),
      signal
    });
  },
  askQuestion(payload) {
    return apiRequest('/api/ask', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify(payload)
    });
  }
};

document.getElementById('adult-confirmation').addEventListener('change', updateAccessButtons);
signInButton.addEventListener('click', signInWithGoogle);
demoButton.addEventListener('click', () => {
  if (!document.getElementById('adult-confirmation').checked) {
    showAuthError('Confirme que você tem 18 anos ou mais para continuar.');
    return;
  }
  localStorage.setItem('aprovaia-adult-confirmed', 'true');
  enterApp(null, true);
});
document.getElementById('signout-button').addEventListener('click', () => {
  if (demoMode) {
    showLogin(true);
    return;
  }
  signOut().catch((error) => {
    console.error('Falha ao sair:', error);
    showAuthError('Não foi possível encerrar a sessão. Tente novamente.');
  });
});

loadFirebase().catch((error) => {
  console.error('Falha ao carregar configuração do AprovaIA:', error);
  authStatus.textContent = 'Não foi possível conectar ao servidor. Inicie a aplicação e recarregue esta página.';
  setupHelp.hidden = false;
});
