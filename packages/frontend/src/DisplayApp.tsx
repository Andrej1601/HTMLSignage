import { DisplayErrorBoundary } from './components/Display/DisplayErrorBoundary';
import { DisplayClientPage } from './pages/DisplayClientPage';

export default function DisplayApp() {
  return (
    <DisplayErrorBoundary>
      <DisplayClientPage />
    </DisplayErrorBoundary>
  );
}
