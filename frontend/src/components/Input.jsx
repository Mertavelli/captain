export default function Input({ label, type = "text", value, onChange, className }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">{label}</label>
            <input
                type={type}
                className={`border px-2 py-1 rounded text-sm ${className}`}
                value={value}
                onChange={e => onChange(e.target.value)}
            />
        </div>
    )
}
