import Modal from '../Modal';
import Input from '../Input';

export default function MemberModal({
    open, onClose, onSubmit,
    isStakeholder, setIsStakeholder,
    firstName, setFirstName,
    lastName, setLastName,
    email, setEmail,
    role, setRole,
    loading, errorMsg,
}) {
    if (!open) return null;
    return (
        <Modal>
            <div className="w-full max-w-sm mx-auto bg-white rounded-xl shadow-2xl p-6 flex flex-col gap-3 z-50">
                <h2 className="text-lg font-bold mb-2">{isStakeholder ? "Add Stakeholder" : "Add Team Member"}</h2>
                <div className="flex flex-col gap-2">
                    <Input label="First Name" value={firstName} onChange={setFirstName} />
                    <Input label="Last Name" value={lastName} onChange={setLastName} />
                    <Input label="Email" type="email" value={email} onChange={setEmail} />
                    <Input label="Role" value={role} onChange={setRole} />
                    <div className="flex items-center gap-2">
                        <input
                            id="isStakeholder"
                            type="checkbox"
                            checked={isStakeholder}
                            onChange={e => setIsStakeholder(e.target.checked)}
                            className="cursor-pointer"
                        />
                        <label htmlFor="isStakeholder" className="text-xs cursor-pointer">Add as stakeholder</label>
                    </div>
                </div>
                {errorMsg && (<div className="text-xs text-red-500">{errorMsg}</div>)}
                <div className="flex justify-end gap-2 mt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm cursor-pointer"
                        disabled={loading}
                    >Cancel</button>
                    <button
                        onClick={onSubmit}
                        className="px-4 py-1 rounded bg-accent hover:brightness-90 text-white text-sm shadow cursor-pointer"
                        disabled={loading}
                    >{loading ? "Adding..." : "Add"}</button>
                </div>
            </div>
        </Modal>
    );
}
