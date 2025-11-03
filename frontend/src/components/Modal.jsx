export default function Modal({ children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all">
            {children}
        </div>
    )
}
