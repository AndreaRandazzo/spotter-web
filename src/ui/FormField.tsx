interface FormFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete?: string;
  required?: boolean;
}

export default function FormField({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  autoComplete,
  required,
}: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-stone-300 mb-1.5"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-md border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100 placeholder-stone-600 focus:border-stone-500 focus:outline-none"
      />
      {error && (
        <p role="alert" className="text-sm text-red-400 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
