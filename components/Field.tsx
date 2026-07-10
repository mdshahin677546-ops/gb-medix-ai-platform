export function Field({
  label,
  name,
  type = "text",
  required = true,
  children
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-ink">
      {label}
      {children ?? (
        <input
          name={name}
          type={type}
          required={required}
          className="premium-input rounded-md px-3 py-3 text-ink outline-none"
        />
      )}
    </label>
  );
}
