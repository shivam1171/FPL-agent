/**
 * React application entry point
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Dev-only: ?ui-preview renders the primitive/screen harness instead of the app,
// so the new UI can be reviewed without a live FPL session. lazy() must live at
// module scope — calling it during render remounts on every pass.
const params = new URLSearchParams(window.location.search);
const previewName = import.meta.env.DEV
  ? (params.has('ui-preview') ? 'ui'
    : params.has('team-preview') ? 'team'
    : params.has('advisor-preview') ? 'advisor'
    : params.has('leagues-preview') ? 'leagues'
    : null)
  : null;

const PreviewComponent =
  previewName === 'ui'
    ? React.lazy(() => import('./dev/UiPreview'))
    : previewName === 'team'
      ? React.lazy(() => import('./dev/TeamPreview'))
      : previewName === 'advisor'
        ? React.lazy(() => import('./dev/AdvisorPreview'))
        : previewName === 'leagues'
          ? React.lazy(() => import('./dev/LeaguesPreview'))
          : null;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {PreviewComponent ? (
      <React.Suspense fallback={null}>
        <PreviewComponent />
      </React.Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
