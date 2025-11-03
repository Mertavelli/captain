export default function Avatar({ name = "", src }) {
    const initials = name
        ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : "";

    return (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 border overflow-hidden">
            {src ? (
                <img
                    src={src}
                    alt={name}
                    className="object-cover rounded-full w-5"
                />
            ) : (
                initials
            )}
        </div>
    );
}
