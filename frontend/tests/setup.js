import '@testing-library/jest-dom';

// jsdom não implementa matchMedia (usado pelo ThemeContext)
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.cookie.split(';').forEach((c) => {
    document.cookie = `${c.split('=')[0].trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
});
