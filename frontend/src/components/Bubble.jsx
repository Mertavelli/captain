export function Bubble({ icon, children }) {
    return (
        <div className="w-13 h-13 rounded-full bg-border flex items-center justify-center hover:bg-gray-200 transition cursor-pointer">
            {icon || children}
        </div>
    )
}