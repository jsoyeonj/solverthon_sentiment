import { Icon } from './Icon';

export function LoadingBanner({ label = '불러오는 중입니다…' }: { label?: string }) {
  return (
    <div className="state-banner" role="status">
      <Icon name="hourglass_top" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="state-banner state-banner--error" role="alert">
      <Icon name="error" />
      <span>{message}</span>
    </div>
  );
}
