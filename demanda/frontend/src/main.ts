import { LoginForm } from './components/LoginForm';
import { App } from './components/App';

// Initialize login form
const loginForm = new LoginForm('loginContainer', () => {
  // When login succeeds, initialize the app
  new App();
  loginForm.hide();
});
