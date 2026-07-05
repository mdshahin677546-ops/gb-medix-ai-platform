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
          className="rounded-md border border-black/15 bg-white px-3 py-3 outline-none focus:border-leaf"
        />
      )}
    </label>
  );
}
