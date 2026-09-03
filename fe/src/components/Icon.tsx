/** Material Symbols 아이콘. name은 아이콘 리거처(예: 'search', 'verified_user'). */
export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={className ? `icon ${className}` : 'icon'} aria-hidden="true">
      {name}
    </span>
  );
}
